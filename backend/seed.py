"""Buildora bulk seed for the 17 SQLAlchemy models supplied in models - zip.zip.

SETUP (Python 3.10+, SQLAlchemy 2.x, synchronous Session):
  1. Save as backend/seed.py, alongside app/, and activate your backend environment.
  2. Install Faker: python -m pip install Faker
     Keep your project's existing SQLAlchemy and PostgreSQL driver dependencies.
  3. The session import is configured for your supplied app/database/db.py:
       from app.database.db import SessionLocal
     It creates a synchronous Session using settings.DATABASE_URL.
     Adapt the import in hash_seed_password() to your real hashing utility.
     The hasher must return the same encoded string your login code verifies.
     This script does not read .env itself: app.core.config must load settings
     as it does for FastAPI, or set them in your shell before running.
  4. FIX THE UPLOADED PROJECT MODEL before applying your normal migrations:
       CheckConstraint(
           "progress_percent >= 0 AND progress_percent <= 100",
           name="check_project_progress",
       )
     The uploaded constraint references nonexistent column `progress`. Correct
     any migration that creates it; use a new migration if already applied.
     Also remove the duplicate `documents` relationship in Project and duplicate
     `uploaded_documents` in User for clarity (these are not seeding blockers).
     This script never creates tables, alters constraints, or runs migrations.
  5. Adjust CONFIG. Defaults add 4 companies, 24 projects, 768 apartments and 2,304 apartment photos.
  6. In PowerShell, set a demo password and run from backend/:
       $env:SEED_PASSWORD = 'Choose-a-demo-password'
       python seed.py --dry-run
       python seed.py

BEHAVIOR:
  - One transaction; any failure rolls back ALL new rows. --dry-run inserts and
    validates then rolls back (requires a database connection and write access).
  - This version uses buildora-expanded-v2 to ADD a separate dataset. Earlier
    demo rows remain; it does not make the entire database total exactly four companies.
  - Reusing seed_key stops before writes if seed users/companies already exist.
    It does not repair partial manually deleted seeds or extend a previous run.
    To add a separate dataset, change seed_key. Existing records are not deleted.
  - Payment category names are reused if present. Deterministic UUIDs and emails,
    checked phone uniqueness, and scoped numbering avoid duplicate conflicts.
  - SQLAlchemy enum columns receive enum MEMBERS; Apartment.status is a String
    column and therefore receives ApartmentStatus.*.value (lowercase).
  - Every new user has the same SEED_PASSWORD, hashed once by your real hasher
    for efficient demo generation. No passwords or database URLs are printed.
    These are app.users accounts, not Supabase Auth auth.users identities.
  - Names, locations, addresses and phone formats are Lebanese demo fixtures.
    Addresses are fictional; prices/budgets are illustrative USD amounts.
    The seed_key is unchanged: this does not modify already committed rows.
  - Old email repair: python seed.py --repair-emails --dry-run, then
    python seed.py --repair-emails. This updates matching seed UUIDs only,
    including older seed keys. User logins change to @example.com.
  - Images use the supplied ImageKit links, reused across demo records.
    Document URLs remain example.invalid placeholders.
  - For existing data: python seed.py --update-images --dry-run, then
    python seed.py --update-images. Keep seed_key/counts matching the original
    dataset. This only updates image fields on matching deterministic seed IDs,
    never creates rows, and needs no SEED_PASSWORD. URLs are not downloaded.
  - Faker/random values are repeatable for a fixed random_seed/reference date;
    UUIDs are stable for a seed_key. Timestamp defaults remain model-managed.
  - Run against the migrated development database using your backend connection.
    Database-only triggers/RLS/extra constraints can still reject inserts; they
    are not bypassed. Inspect failures with --dry-run before committing.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass, fields
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import os
import random
import re
from uuid import NAMESPACE_URL, uuid5

from faker import Faker
from sqlalchemy import CheckConstraint, select, text
from sqlalchemy.orm import Session, configure_mappers

# All model imports match the uploaded package. Adapt app.models only if moved.
from app.models import (
    Apartment, ApartmentImage, Building, Company, CompanyMembership,
    ConstructionStage, Document, Floor, LandRecord, Lead, Party, Payment,
    PaymentCategory, Project, Task, TaskUpdate, User,
)
from app.models.apartment import ApartmentStatus
from app.models.company_membership import CompanyRole
from app.models.construction_stage import ConstructionStageStatus
from app.models.lead import LeadStatus
from app.models.party import PartyType
from app.models.project import ProjectStatus
from app.models.task import TaskStatus
from app.models.user import PlatformRole


# --------------------------- PROJECT INTEGRATION --------------------------
def make_session() -> Session:
    # Matches the supplied db.py; use the factory, not the get_db() generator.
    from app.database.db import SessionLocal
    return SessionLocal()


def hash_seed_password(password: str) -> str:
    # Change module/name to your existing function, e.g. get_password_hash.
    from app.core.security import hash_password
    return hash_password(password)


# ------------------------------ CONFIGURATION -----------------------------
@dataclass(frozen=True)
class SeedConfig:
    seed_key: str = "buildora-expanded-v2"
    random_seed: int = 42
    reference_date: date | None = None  # None means today's date.
    locale: str = "en_US"
    companies: int = 4
    users_per_company: int = 10  # Owner, manager, engineer, sales, finance.
    projects_per_company: int = 6
    parties_per_company: int = 8
    buildings_per_project: int = 2
    floors_per_building: int = 4
    apartments_per_floor: int = 4
    stages_per_project: int = 6
    tasks_per_stage: int = 4
    updates_per_task: int = 2
    leads_per_apartment: int = 2
    images_per_apartment: int = 3
    payments_per_project: int = 15
    documents_per_project: int = 3
    batch_size: int = 500


# Use the numbered URL text supplied by the user (not the repeated link targets).
APARTMENT_IMAGE_URLS = tuple(
    f"https://ik.imagekit.io/hamzaMerhi/apartments/images/{i}.png" for i in range(1, 10)
)
PROJECT_IMAGE_URLS = tuple(
    f"https://ik.imagekit.io/hamzaMerhi/projects/images/{i}.png" for i in range(1, 8)
)
TASK_UPDATE_IMAGE_URLS = tuple(
    f"https://ik.imagekit.io/hamzaMerhi/task-updates/{i}.png" for i in range(1, 10)
)
COMPANY_LOGO_URLS = (
    "https://ik.imagekit.io/hamzaMerhi/companies/logos/f049f3d28ba1.webp",
    "https://ik.imagekit.io/hamzaMerhi/companies/logos/1.png",
    "https://ik.imagekit.io/hamzaMerhi/companies/logos/2.png",
    "https://ik.imagekit.io/hamzaMerhi/companies/logos/3.png",
)


def apartment_images(label, count):
    # Reproducible sampling WITHOUT replacement: no repeated photo per apartment.
    return random.Random(uuid5(NAMESPACE_URL, label).int).sample(APARTMENT_IMAGE_URLS, count)


def image_for(label, urls):
    return urls[uuid5(NAMESPACE_URL, label).int % len(urls)]


# Fictional demo identities and addresses, inspired by Lebanon.
# Monetary demo values are intended as USD amounts, not live market valuations.
LEBANON_LOCATIONS = (
    "Achrafieh, Beirut, Lebanon", "Hamra, Beirut, Lebanon",
    "Mar Mikhael, Beirut, Lebanon", "Verdun, Beirut, Lebanon",
    "Jounieh, Lebanon", "Kaslik, Lebanon", "Byblos, Lebanon",
    "Batroun, Lebanon", "Tripoli, Lebanon", "Ehden, Lebanon",
    "Bcharre, Lebanon", "Zgharta, Lebanon", "Baabda, Lebanon",
    "Broummana, Lebanon", "Beit Mery, Lebanon", "Aley, Lebanon",
    "Bhamdoun, Lebanon", "Deir el Qamar, Lebanon", "Zahle, Lebanon",
    "Chtaura, Lebanon", "Baalbek, Lebanon", "Saida, Lebanon",
    "Tyre, Lebanon", "Nabatieh, Lebanon",
)
LEBANESE_FIRST_NAMES = (
    "Hamza", "Karim", "Rami", "Jad", "Omar", "Ali", "Hassan", "Fadi",
    "Georges", "Elias", "Maya", "Nour", "Layla", "Rana", "Yara", "Rita",
    "Dalia", "Sara", "Zeina", "Mariam",
)
LEBANESE_LAST_NAMES = (
    "Merhi", "Haddad", "Khoury", "Saad", "Mansour", "Nassar", "Karam",
    "Hachem", "Salameh", "Farah", "Daher", "Hamdan", "Abboud", "Khalil",
)
COMPANY_NAMES = (
    "Cedar Coast Development", "Byblos Homes Construction",
    "Mount Lebanon Builders", "Bekaa Valley Development",
)


def lebanese_name(rng):
    return f"{rng.choice(LEBANESE_FIRST_NAMES)} {rng.choice(LEBANESE_LAST_NAMES)}"


def lebanese_phone(rng):
    # Synthetic +961 mobile-format numbers; never used to send calls or texts.
    return f"+961{rng.choice(('70', '71', '76', '78', '79', '81'))}{rng.randrange(1000000):06d}"


def lebanese_address(rng, location):
    return f"Building {rng.randint(1, 80)}, Cedar Street, {location}"


CONFIG = SeedConfig()
CATEGORY_NAMES = ("Materials", "Labor", "Equipment", "Permits", "Utilities")
STAGE_NAMES = (
    "Site preparation", "Foundations", "Structural works", "Mechanical and electrical",
    "Interior finishes", "Inspection and handover",
)
ROLES = (
    CompanyRole.OWNER, CompanyRole.PROJECT_MANAGER, CompanyRole.SITE_ENGINEER,
    CompanyRole.SALES, CompanyRole.FINANCE,
)
MODELS = (
    User, Company, CompanyMembership, PaymentCategory, Party, Project, LandRecord,
    Building, Floor, Apartment, ApartmentImage, Lead, ConstructionStage, Task,
    TaskUpdate, Payment, Document,
)


def validate_config(c: SeedConfig) -> None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", c.seed_key):
        raise ValueError("seed_key must be 1-32 lowercase letters/digits/hyphens.")
    for f in fields(c):
        value = getattr(c, f.name)
        if f.name not in {"seed_key", "locale", "reference_date", "random_seed"}:
            if type(value) is not int or value < 0:
                raise ValueError(f"{f.name} must be a nonnegative integer.")
    if c.companies < 1 or c.users_per_company < 5 or c.batch_size < 1:
        raise ValueError("Need companies >= 1, users_per_company >= 5, batch_size >= 1.")
    if c.projects_per_company and c.payments_per_project and not c.parties_per_company:
        raise ValueError("Payments require at least one party per company.")
    if c.images_per_apartment > len(APARTMENT_IMAGE_URLS):
        raise ValueError("images_per_apartment cannot exceed the 9 distinct photos.")
    if not c.stages_per_project or not c.tasks_per_stage:
        raise ValueError("stages_per_project and tasks_per_stage must be positive.")


def check_models() -> None:
    configure_mappers()
    for constraint in Project.__table__.constraints:
        if isinstance(constraint, CheckConstraint) and re.search(
            r"\bprogress\b", str(constraint.sqltext)
        ):
            raise ValueError(
                "Project CheckConstraint references 'progress', but the model column "
                "is 'progress_percent'. Correct the constraint and migrations as "
                "documented at the top of seed.py, then retry."
            )


def seed_id(c: SeedConfig, label: str):
    return uuid5(NAMESPACE_URL, f"buildora-seed/{c.seed_key}/{label}")


def status_for(progress: int, enum_type):
    if progress == 0:
        return enum_type.NOT_STARTED
    return enum_type.COMPLETED if progress == 100 else enum_type.IN_PROGRESS


class Writer:
    """Bounded ORM batches, with explicit flushes before dependent tables."""
    def __init__(self, db: Session, c: SeedConfig):
        self.db, self.c = db, c
        self.counts = Counter()
        self.pending = 0

    def add(self, model, label: str, **values):
        row = model(id=seed_id(self.c, label), **values)
        self.db.add(row)
        self.counts[model.__tablename__] += 1
        self.pending += 1
        if self.pending >= self.c.batch_size:
            self.flush()
        return row

    def flush(self):
        self.db.flush()
        self.pending = 0


def populate(db: Session, c: SeedConfig, password_hash: str) -> Counter:
    rng = random.Random(c.random_seed)
    fake = Faker(c.locale)
    fake.seed_instance(c.random_seed)
    today = c.reference_date or date.today()
    w = Writer(db, c)

    # Serialize this script's PostgreSQL runs, including shared category inserts.
    # Unique constraints remain the final protection against unrelated writers.
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(728419531)"))

    user_ids = [seed_id(c, f"company/{ci}/user/{ui}")
                for ci in range(c.companies) for ui in range(c.users_per_company)]
    company_ids = [seed_id(c, f"company/{ci}") for ci in range(c.companies)]
    # Chunk queries to avoid parameter limits for large user counts.
    for model, ids in ((User, user_ids), (Company, company_ids)):
        for offset in range(0, len(ids), c.batch_size):
            if db.scalar(select(model.id).where(model.id.in_(ids[offset:offset+c.batch_size])).limit(1)):
                raise ValueError(
                    f"Seed key '{c.seed_key}' already has records. No data added. "
                    "Use a new seed_key for a separate dataset; this script does "
                    "not extend or repair an earlier seed."
                )

    categories = []
    for name in CATEGORY_NAMES:
        category = db.scalar(select(PaymentCategory).where(PaymentCategory.name == name))
        if category is None:
            category = w.add(PaymentCategory, f"category/{name}", name=name)
            w.flush()
        categories.append(category)

    # Generate phone numbers, check both current run and existing users, and retry.
    allocated_phones = set()
    def user_phone():
        for _ in range(1000):
            number = lebanese_phone(rng)
            if number not in allocated_phones and db.scalar(
                select(User.id).where(User.phone == number).limit(1)
            ) is None:
                allocated_phones.add(number)
                return number
        raise ValueError("Could not allocate a unique user phone number.")

    for ci in range(c.companies):
        cp = f"company/{ci}"
        company = w.add(
            Company, cp, name=COMPANY_NAMES[ci % len(COMPANY_NAMES)],
            email=f"{c.seed_key}-company-{ci+1}@example.com",
            phone=lebanese_phone(rng), address=lebanese_address(rng, LEBANON_LOCATIONS[(ci*c.projects_per_company) % len(LEBANON_LOCATIONS)]), is_active=True, logo=COMPANY_LOGO_URLS[ci % len(COMPANY_LOGO_URLS)],
        )
        users = []
        for ui in range(c.users_per_company):
            email = f"{c.seed_key}-c{ci+1}-u{ui+1}@example.com"
            if db.scalar(select(User.id).where(User.email == email).limit(1)):
                raise ValueError(f"Seed email already exists: {email}. No changes committed.")
            users.append(w.add(
                User, f"{cp}/user/{ui}", name=lebanese_name(rng), email=email,
                phone=user_phone(), password_hash=password_hash,
                platform_role=PlatformRole.USER, is_active=True,
            ))
        w.flush()
        for ui, user in enumerate(users):
            w.add(CompanyMembership, f"{cp}/membership/{ui}", company_id=company.id,
                  user_id=user.id, role=ROLES[ui] if ui < 5 else rng.choice(ROLES[1:]),
                  is_active=True)
        owner, manager, engineer, sales, finance = users[:5]
        parties = []
        for pi in range(c.parties_per_company):
            parties.append(w.add(
                Party, f"{cp}/party/{pi}", company_id=company.id,
                name=f"{rng.choice(LEBANESE_LAST_NAMES)} {'Contracting' if pi % 2 == 0 else 'Building Supplies'}", type=PartyType.CONTRACTOR if pi % 2 == 0 else PartyType.SUPPLIER,
                phone=lebanese_phone(rng), email=f"{c.seed_key}-c{ci+1}-party-{pi+1}@example.com",
                address=lebanese_address(rng, LEBANON_LOCATIONS[(ci*c.projects_per_company) % len(LEBANON_LOCATIONS)]),
                notes=rng.choice(("Concrete and masonry", "Electrical systems", "Finishing materials")),
            ))
        w.flush()
        contractors = [p for p in parties if p.type == PartyType.CONTRACTOR]

        for pj in range(c.projects_per_company):
            pp = f"{cp}/project/{pj}"
            project_location = LEBANON_LOCATIONS[(ci*c.projects_per_company+pj) % len(LEBANON_LOCATIONS)]
            # Cover all statuses when there are four or more projects.
            project_status = tuple(ProjectStatus)[pj % len(ProjectStatus)]
            total_tasks = c.stages_per_project * c.tasks_per_stage
            if project_status == ProjectStatus.COMPLETED:
                complete_tasks, partial = total_tasks, 0
                start = today - timedelta(days=total_tasks * 3 + 90)
            elif project_status == ProjectStatus.PLANNING:
                complete_tasks, partial = 0, 0
                start = today + timedelta(days=rng.randint(10, 45))
            else:
                complete_tasks = rng.randrange(total_tasks)
                partial = rng.randint(10, 90)
                start = today - timedelta(days=complete_tasks * 3 + 1)
            task_progress = [100 if i < complete_tasks else partial if i == complete_tasks else 0
                             for i in range(total_tasks)]
            progress = round(sum(task_progress) / total_tasks)
            if project_status in (ProjectStatus.IN_PROGRESS, ProjectStatus.ON_HOLD):
                progress = max(1, min(99, progress))
            finish = start + timedelta(days=total_tasks * 3)
            project = w.add(
                Project, pp, company_id=company.id, created_by=owner.id,
                name=f"{project_location.split(',')[0]} Residences {pj+1}",
                description=f"Residential development in {project_location}, with balconies, parking and shared outdoor areas.",
                location=project_location, start_date=start, expected_end_date=finish,
                status=project_status, progress_percent=progress, image=image_for(pp, PROJECT_IMAGE_URLS),
                budget=Decimal(rng.randint(2000000, 15000000)).quantize(Decimal("0.01")),
            )
            w.flush()
            w.add(LandRecord, f"{pp}/land", project_id=project.id,
                  area_sqm=Decimal(rng.randint(5000, 15000)),
                  parcel_number=f"{c.seed_key}-{ci+1}-{pj+1}",
                  max_height_m=Decimal(c.floors_per_building * 3 + 6),
                  building_ratio=Decimal("0.45"),
                  constraints="Maintain boundary setbacks and emergency access.",
                  notes="Synthetic planning information for demonstration.")
            for bi in range(c.buildings_per_project):
                bp = f"{pp}/building/{bi}"
                building = w.add(Building, bp, project_id=project.id, name=f"Building {bi+1}",
                                 description="Residential building with elevator access.")
                w.flush()
                for fi in range(1, c.floors_per_building + 1):
                    fp = f"{bp}/floor/{fi}"
                    floor = w.add(Floor, fp, building_id=building.id, floor_number=fi,
                                  name=f"Floor {fi}", description="Residential floor")
                    w.flush()
                    apartments = []
                    for ai in range(1, c.apartments_per_floor + 1):
                        ap = f"{fp}/apartment/{ai}"
                        bedrooms = rng.randint(1, 4)
                        area = Decimal(rng.randint(50 + bedrooms*20, 90 + bedrooms*35))
                        apartment_status = rng.choices(tuple(ApartmentStatus), weights=(6, 2, 2))[0]
                        apartment = w.add(
                            Apartment, ap, floor_id=floor.id, unit_number=f"{fi}-{ai:02d}",
                            area_sqm=area, bedrooms=bedrooms, bathrooms=max(1, bedrooms-1),
                            price=(area * Decimal(rng.randint(1200, 2800))).quantize(Decimal("0.01")),
                            status=apartment_status.value,
                            is_public=apartment_status == ApartmentStatus.AVAILABLE,
                            description=f"Bright {bedrooms}-bedroom apartment in {project_location}, with balcony, parking and provision for backup power.",
                        )
                        apartments.append((ap, apartment))
                    w.flush()
                    for ap, apartment in apartments:
                        for ii, image_url in enumerate(apartment_images(ap, c.images_per_apartment)):
                            w.add(ApartmentImage, f"{ap}/image/{ii}", apartment_id=apartment.id,
                                  image_url=image_url)
                        for li in range(c.leads_per_apartment):
                            w.add(Lead, f"{ap}/lead/{li}", apartment_id=apartment.id,
                                  name=lebanese_name(rng), phone=lebanese_phone(rng), email=fake.ascii_safe_email(),
                                  message=rng.choice(("Please arrange a viewing.", "Is financing available?",
                                                      "Please send the floor plan and payment schedule.")),
                                  status=rng.choice(tuple(LeadStatus)))
            for si in range(c.stages_per_project):
                sp = f"{pp}/stage/{si}"
                values = task_progress[si*c.tasks_per_stage:(si+1)*c.tasks_per_stage]
                stage_progress = round(sum(values) / len(values))
                if 0 < sum(values) < len(values)*100:
                    stage_progress = max(1, min(99, stage_progress))
                stage_start = start + timedelta(days=si*c.tasks_per_stage*3)
                stage_end = stage_start + timedelta(days=c.tasks_per_stage*3)
                stage_name = STAGE_NAMES[si] if si < len(STAGE_NAMES) else f"Additional works {si+1}"
                stage = w.add(ConstructionStage, sp, project_id=project.id, name=stage_name,
                              description=f"{stage_name} work package", order_index=si+1,
                              start_date=stage_start, due_date=stage_end,
                              progress_percent=stage_progress,
                              status=status_for(stage_progress, ConstructionStageStatus))
                w.flush()
                for ti, task_p in enumerate(values):
                    tp = f"{sp}/task/{ti}"
                    task_start = stage_start + timedelta(days=ti*3)
                    task_end = task_start + timedelta(days=3)
                    task = w.add(Task, tp, stage_id=stage.id,
                                 title=f"{stage_name}: work area {ti+1}",
                                 description="Complete assigned work and verify quality before sign-off.",
                                 assigned_to=engineer.id,
                                 party_id=rng.choice(contractors).id if contractors else None,
                                 start_date=task_start, due_date=task_end,
                                 status=status_for(task_p, TaskStatus), progress_percent=task_p)
                    w.flush()
                    # Ascending snapshots, with the last matching the current task.
                    last_update_day = min(today, task_end)
                    for ui in range(c.updates_per_task):
                        update_p = task_p * (ui+1) // c.updates_per_task
                        stamp = datetime.combine(last_update_day, time(9)) - timedelta(
                            minutes=c.updates_per_task-ui-1)
                        w.add(TaskUpdate, f"{tp}/update/{ui}", task_id=task.id,
                              user_id=engineer.id, progress_percent=update_p,
                              photo_url=image_for(f"{tp}/update/{ui}", TASK_UPDATE_IMAGE_URLS),
                              status=status_for(update_p, TaskStatus), created_at=stamp,
                              notes=f"Progress recorded at {update_p}%; quality review logged.")
            for pi in range(c.payments_per_project):
                category = rng.choice(categories)
                w.add(Payment, f"{pp}/payment/{pi}", project_id=project.id,
                      party_id=rng.choice(parties).id, category_id=category.id,
                      amount=(Decimal(rng.randint(10000, 5000000))/100).quantize(Decimal("0.01")),
                      payment_date=min(start, today) + timedelta(
                          days=rng.randint(0, (today-min(start, today)).days)),
                      description=f"{category.name} installment {pi+1}",
                      reference=f"{c.seed_key}-C{ci+1}-P{pj+1}-{pi+1:04d}", created_by=finance.id)
            for di in range(c.documents_per_project):
                title = ("Site plan", "Building permit", "Progress report")[di % 3]
                w.add(Document, f"{pp}/document/{di}", project_id=project.id,
                      uploaded_by=manager.id, name=f"{title} {di+1}", category=title,
                      file_url=f"https://example.invalid/seed/{project.id}/document-{di+1}.pdf",
                      file_type="application/pdf", original_filename=f"document-{di+1}.pdf")
            w.flush()
            print(f"Prepared company {ci+1}/{c.companies}, project {pj+1}/{c.projects_per_company}; "
                  f"{sum(w.counts.values()):,} rows prepared (not committed yet).", flush=True)
    w.flush()
    return w.counts


def run_seed(c: SeedConfig = CONFIG, *, dry_run: bool = False,
             session_factory=None, password_hasher=None) -> Counter:
    validate_config(c)
    check_models()
    password = os.environ.get("SEED_PASSWORD")
    if not password:
        raise ValueError("Set SEED_PASSWORD in your environment before running.")
    encoded = (password_hasher or hash_seed_password)(password)
    if not isinstance(encoded, str) or not encoded or encoded == password:
        raise ValueError("The password hasher must return a nonempty encoded hash, not plaintext.")
    db = (session_factory or make_session)()
    if not isinstance(db, Session):
        raise TypeError("make_session() must return a synchronous SQLAlchemy Session.")
    try:
        if db.in_transaction():
            raise ValueError("Session factory must return a fresh session without an active transaction.")
        db.begin()
        counts = populate(db, c, encoded)
        if dry_run:
            db.rollback()
        else:
            db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()
    print("Dry run passed; all inserts rolled back." if dry_run else "Seed committed successfully.")
    for name, count in sorted(counts.items()):
        print(f"  {name}: {count:,}")
    print(f"  TOTAL NEW ROWS: {sum(counts.values()):,}")
    print(f"First owner login: {c.seed_key}-c1-u1@example.com (password: SEED_PASSWORD)")
    return counts


def update_images(c: SeedConfig = CONFIG, *, dry_run=False, session_factory=None):
    """Replace images on matching seeded rows; preserve other records."""
    validate_config(c)
    targets = []
    for ci in range(c.companies):
        cp = f"company/{ci}"
        targets.append((Company, cp, "logo", COMPANY_LOGO_URLS[ci % len(COMPANY_LOGO_URLS)]))
        for pj in range(c.projects_per_company):
            pp = f"{cp}/project/{pj}"
            targets.append((Project, pp, "image", image_for(pp, PROJECT_IMAGE_URLS)))
            for bi in range(c.buildings_per_project):
                for fi in range(1, c.floors_per_building + 1):
                    for ai in range(1, c.apartments_per_floor + 1):
                        ap = f"{pp}/building/{bi}/floor/{fi}/apartment/{ai}"
                        for ii, image_url in enumerate(apartment_images(ap, c.images_per_apartment)):
                            label = f"{ap}/image/{ii}"
                            targets.append((ApartmentImage, label, "image_url",
                                            image_url))
            for si in range(c.stages_per_project):
                for ti in range(c.tasks_per_stage):
                    for ui in range(c.updates_per_task):
                        label = f"{pp}/stage/{si}/task/{ti}/update/{ui}"
                        targets.append((TaskUpdate, label, "photo_url",
                                        image_for(label, TASK_UPDATE_IMAGE_URLS)))
    counts = Counter()
    with (session_factory or make_session)() as db:
        with db.begin():
            if db.get_bind().dialect.name == "postgresql":
                db.execute(text("SELECT pg_advisory_xact_lock(728419531)"))
            for model, label, field, url in targets:
                row = db.get(model, seed_id(c, label))
                if row is not None and getattr(row, field) != url:
                    setattr(row, field, url)
                    counts[model.__tablename__] += 1
            db.flush()
            if dry_run:
                db.rollback()
    print("Image dry run rolled back." if dry_run else "Image updates committed.")
    print(f"Changed image fields: {sum(counts.values())}")
    if not counts:
        print("Images already match, or no rows match this seed_key/counts.")
    return counts


def repair_emails(*, dry_run=False, session_factory=None):
    """Repair old demo emails only when both the email pattern and seed UUID match.

    Covers earlier seed keys/counts as well as the current configuration.
    Does not require SEED_PASSWORD. No accounts or relationships are recreated.
    """
    patterns = (
        (User, r"([a-z0-9][a-z0-9-]{0,31})-c([1-9][0-9]*)-u([1-9][0-9]*)",
         lambda m: f"company/{int(m[2])-1}/user/{int(m[3])-1}"),
        (Company, r"([a-z0-9][a-z0-9-]{0,31})-company-([1-9][0-9]*)",
         lambda m: f"company/{int(m[2])-1}"),
        (Party, r"([a-z0-9][a-z0-9-]{0,31})-c([1-9][0-9]*)-party-([1-9][0-9]*)",
         lambda m: f"company/{int(m[2])-1}/party/{int(m[3])-1}"),
    )
    counts = Counter()
    from pydantic import TypeAdapter, EmailStr
    email_validator = TypeAdapter(EmailStr)
    with (session_factory or make_session)() as db:
        with db.begin():
            if db.get_bind().dialect.name == "postgresql":
                db.execute(text("SELECT pg_advisory_xact_lock(728419531)"))
            for model, pattern, label_for in patterns:
                for row in db.scalars(select(model).where(model.email.endswith("@example.test"))):
                    local = row.email.rsplit('@', 1)[0]
                    match = re.fullmatch(pattern, local)
                    if not match:
                        continue
                    expected_id = uuid5(NAMESPACE_URL, f"buildora-seed/{match[1]}/{label_for(match)}")
                    if row.id != expected_id:
                        continue
                    replacement = email_validator.validate_python(local + '@example.com')
                    if model is User and db.scalar(select(User.id).where(
                        User.email == replacement, User.id != row.id
                    )):
                        raise ValueError(f"Email conflict for {replacement}; repair rolled back.")
                    row.email = replacement
                    counts[model.__tablename__] += 1
            db.flush()
            if dry_run:
                db.rollback()
    print("Email repair dry run rolled back." if dry_run else "Email repair committed.")
    for table, count in sorted(counts.items()):
        print(f"  {table}: {count}")
    print(f"Changed email fields: {sum(counts.values())}")
    print("Repaired users now log in with @example.com; passwords are unchanged.")
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate related Buildora demo data.")
    parser.add_argument("--dry-run", action="store_true", help="Validate inserts, then roll back.")
    parser.add_argument("--update-images", action="store_true", help="Update existing seeded image fields only.")
    parser.add_argument("--repair-emails", action="store_true", help="Repair old @example.test seed addresses without reseeding.")
    args = parser.parse_args()
    if args.repair_emails and args.update_images:
        parser.error("Choose either --repair-emails or --update-images.")
    try:
        if args.repair_emails:
            repair_emails(dry_run=args.dry_run)
        elif args.update_images:
            update_images(dry_run=args.dry_run)
        else:
            run_seed(dry_run=args.dry_run)
    except (ImportError, ValueError, TypeError) as exc:
        parser.exit(1, f"Seed setup failed: {exc}\nSee the setup instructions at the top of seed.py.\n")
