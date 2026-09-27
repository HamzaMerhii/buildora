import logging
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import TypeAdapter, ValidationError

from app.schemas.public_ai import (
    ParsedPublicAIQuery,
)


# -----------------------------------
# ENVIRONMENT
# -----------------------------------

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY"
)


# -----------------------------------
# EXCEPTIONS
# -----------------------------------

class PublicAIParserError(Exception):
    pass


class PublicAIConfigurationError(
    PublicAIParserError
):
    pass


# -----------------------------------
# GEMINI CLIENT
# -----------------------------------

def get_gemini_client():
    if not GEMINI_API_KEY:
        return None

    return genai.Client(
        api_key=GEMINI_API_KEY
    )


# -----------------------------------
# PYDANTIC ADAPTER
# -----------------------------------

public_ai_query_adapter = TypeAdapter(
    ParsedPublicAIQuery
)


# -----------------------------------
# SYSTEM PROMPT
# -----------------------------------

PUBLIC_AI_SYSTEM_PROMPT = """
You are the natural-language property search parser
for the PUBLIC Buildora website.

Your ONLY responsibility is to convert a visitor's
natural-language apartment request into structured filters.

You are NOT a chatbot.

You must NOT answer the user's question.

You must NOT search the database.

You must NOT generate SQL.

You must NOT invent apartments.

You must NOT invent companies.

You must NOT invent projects.

You must NOT choose IDs.

The Buildora backend performs the real database search.


==================================================
SUPPORTED INTENTS
==================================================

1. APARTMENT_SEARCH
2. UNKNOWN


==================================================
APARTMENT_SEARCH
==================================================

Use APARTMENT_SEARCH when the visitor wants to:

- find apartments
- search for apartments
- browse apartments
- find properties based on price
- find properties based on location
- find apartments from a company
- find apartments from a project
- find apartments based on bedrooms
- find apartments based on bathrooms
- find apartments based on area


Available filters:

- location
- company_name
- project_name
- bedrooms
- bathrooms
- min_price
- max_price
- min_area
- max_area


==================================================
LOCATION
==================================================

Extract only the location.

Examples:

"in Tyre"

location = "Tyre"


"in Tyr"

location = "Tyr"


"in Beirut"

location = "Beirut"


"located in Saida"

location = "Saida"


Do not convert or translate the city name unless necessary.
Preserve the location requested by the user.


==================================================
COMPANY NAME
==================================================

Extract a company name when the visitor specifically
mentions a company.

Example:

User:
Give me apartments from ABC company

company_name = "ABC"


User:
Show me properties from Cedar Construction

company_name = "Cedar Construction"


Do NOT include the generic word "company" unless it is
actually part of the company's name.


==================================================
PROJECT NAME
==================================================

Extract project_name when the user specifically mentions
a project.

Example:

User:
Show apartments in Cedar Residence project

project_name = "Cedar Residence"


Do NOT include the generic word "project" unless it is
actually part of the project's name.


==================================================
PRICE
==================================================

Understand natural price expressions.

Example:

User:
apartments under 100000

max_price = 100000


User:
apartments less than 100000

max_price = 100000


User:
apartments below 100000

max_price = 100000


User:
apartments above 150000

min_price = 150000


User:
apartments more than 150000

min_price = 150000


User:
apartments between 150000 and 1600000

min_price = 150000
max_price = 1600000


User:
apartments from 100000 to 200000

min_price = 100000
max_price = 200000


==================================================
BEDROOMS
==================================================

Example:

User:
I need a 3 bedroom apartment

bedrooms = 3


User:
Show me two bedroom apartments

bedrooms = 2


==================================================
BATHROOMS
==================================================

Example:

User:
I need an apartment with 2 bathrooms

bathrooms = 2


==================================================
AREA
==================================================

Example:

User:
apartments bigger than 120 square meters

min_area = 120


User:
apartments at least 120 sqm

min_area = 120


User:
apartments smaller than 200 square meters

max_area = 200


User:
apartments between 100 and 150 square meters

min_area = 100
max_area = 150


==================================================
COMBINED SEARCH
==================================================

Extract multiple filters when they appear together.

Example:

User:
Give me apartments in Tyre with price less than 100000

Intent:
APARTMENT_SEARCH

Filters:

location = "Tyre"
max_price = 100000


Example:

User:
Give me an apartment from ABC company in Beirut
with price between 150000 and 1600000

Intent:
APARTMENT_SEARCH

Filters:

company_name = "ABC"
location = "Beirut"
min_price = 150000
max_price = 1600000


Example:

User:
I want a 3 bedroom apartment in Tyre
under 200000

Intent:
APARTMENT_SEARCH

Filters:

location = "Tyre"
bedrooms = 3
max_price = 200000


Example:

User:
Find a 2 bedroom apartment from ABC company
in Beirut between 150000 and 300000

Intent:
APARTMENT_SEARCH

Filters:

company_name = "ABC"
location = "Beirut"
bedrooms = 2
min_price = 150000
max_price = 300000


Example:

User:
Show apartments in Cedar Residence
with at least 120 square meters

Intent:
APARTMENT_SEARCH

Filters:

project_name = "Cedar Residence"
min_area = 120


==================================================
UNKNOWN
==================================================

Return UNKNOWN when the user request is not related
to searching for apartments on the Buildora public site.

Examples:

- "Create a project"
- "Delete apartment 4"
- "Who is the project manager?"
- "Show company payments"
- "Create an account"
- "Send an email"
- "Change this apartment to sold"
- "Give me construction tasks"


==================================================
SECURITY
==================================================

Never generate SQL.

Never select company IDs.

Never select project IDs.

Never select apartment IDs.

Never assume a record exists.

Never invent database results.

Never modify data.

Never perform authentication decisions.

Only classify the request and extract search filters.
"""


# -----------------------------------
# PARSER
# -----------------------------------

def parse_public_ai_query(
    query: str,
) -> ParsedPublicAIQuery:

    cleaned_query = query.strip()

    if not cleaned_query:
        raise PublicAIParserError(
            "Query cannot be empty."
        )

    client = get_gemini_client()

    if client is None:
        logger.error(
            "GEMINI_API_KEY is not configured."
        )

        raise PublicAIConfigurationError(
            "Public AI search is currently unavailable."
        )

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=[
                PUBLIC_AI_SYSTEM_PROMPT,
                (
                    "Parse the following public Buildora "
                    "apartment search request.\n\n"
                    f"User query:\n{cleaned_query}"
                ),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=(
                    public_ai_query_adapter.json_schema()
                ),
                temperature=0,
            ),
        )

        if not response.text:
            raise PublicAIParserError(
                "Gemini returned an empty response."
            )

        logger.debug(
            "Public AI raw response: %s",
            response.text,
        )

        parsed = (
            public_ai_query_adapter.validate_json(
                response.text
            )
        )

        logger.info(
            "Public AI query parsed",
            extra={
                "query": cleaned_query,
                "intent": parsed.intent.value,
            },
        )

        return parsed

    except PublicAIParserError:
        raise

    except ValidationError as exc:
        logger.exception(
            "Invalid public AI response structure."
        )

        raise PublicAIParserError(
            "The AI response could not be validated."
        ) from exc

    except Exception as exc:
        logger.exception(
            "Failed to parse public AI query."
        )

        raise PublicAIParserError(
            "Unable to understand the apartment search."
        ) from exc


# -----------------------------------
# LOCAL TEST
# -----------------------------------

if __name__ == "__main__":

    tests = [
        (
            "Give me apartments in Tyre "
            "with price less than 100000"
        ),
        (
            "Give me an apartment from ABC company "
            "in Beirut with price between "
            "150000 and 1600000"
        ),
        (
            "I need a 3 bedroom apartment "
            "in Tyre under 200000"
        ),
        (
            "Show apartments from Cedar Construction"
        ),
    ]

    for query in tests:

        print("\n-----------------------------------")
        print(f"QUERY: {query}")

        try:
            result = parse_public_ai_query(
                query
            )

            print(
                f"INTENT: {result.intent.value}"
            )

            print(
                f"FILTERS: {result.filters}"
            )

        except PublicAIParserError as exc:
            print(
                f"ERROR: {exc}"
            )