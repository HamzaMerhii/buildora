import uuid

from fastapi import HTTPException, UploadFile, status
from imagekitio import ImageKit

from app.core.config import settings


COMPANY_LOGO_FOLDER = "/companies/logos/"
PROJECT_IMAGE_FOLDER = "/projects/images/"
APARTMENT_IMAGE_FOLDER = "/apartments/images/"
TASK_UPDATE_IMAGE_FOLDER = "/task-updates"
DOCUMENT_FILE_FOLDER = "/documents"

ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "image/webp",
}
ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

ALLOWED_LOGO_MIME_TYPES = ALLOWED_IMAGE_MIME_TYPES
ALLOWED_PROJECT_IMAGE_MIME_TYPES = ALLOWED_IMAGE_MIME_TYPES
ALLOWED_APARTMENT_IMAGE_MIME_TYPES = ALLOWED_IMAGE_MIME_TYPES

_EXTENSION_BY_MIME_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def get_imagekit_client() -> ImageKit:
    if not settings.IMAGEKIT_PRIVATE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload is not configured",
        )
    return ImageKit(private_key=settings.IMAGEKIT_PRIVATE_KEY)


def _build_logo_filename(content_type: str, original_filename: str | None) -> str:
    extension = _EXTENSION_BY_MIME_TYPE.get((content_type or "").lower(), "")
    if not extension and original_filename and "." in original_filename:
        candidate = "." + original_filename.rsplit(".", 1)[-1].lower()
        if candidate == ".jpeg":
            candidate = ".jpg"
        if candidate in {".jpg", ".png", ".webp"}:
            extension = candidate
    return f"{uuid.uuid4().hex}{extension}"


async def _upload_image(file: UploadFile, *, folder: str, kind: str) -> str:
    content_type = (file.content_type or "").lower()

    if content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported {kind} type. Allowed types: JPEG, PNG, WEBP",
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded {kind} file is empty",
        )

    filename = _build_logo_filename(content_type, file.filename)
    client = get_imagekit_client()

    try:
        result = client.files.upload(
            file=contents,
            file_name=filename,
            folder=folder,
            use_unique_file_name=True,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to upload {kind}. Please try again",
        )

    url = getattr(result, "url", None)

    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to upload {kind}. Please try again",
        )

    return url

async def _upload_file(
    file: UploadFile,
    folder: str,
    kind: str,
) -> str:
    if file.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported document file type. "
                "Allowed types: PDF, DOC, DOCX, XLS, XLSX, JPEG, PNG, WEBP"
            ),
        )

    file_bytes = await file.read()

    imagekit = get_imagekit_client()

    result = imagekit.files.upload(
        file=file_bytes,
        file_name=file.filename or "document",
        folder=folder,
    )

    return result.url
async def upload_company_logo(logo: UploadFile) -> str:
    return await _upload_image(logo, folder=COMPANY_LOGO_FOLDER, kind="company logo")


async def upload_project_image(image: UploadFile) -> str:
    return await _upload_image(image, folder=PROJECT_IMAGE_FOLDER, kind="project image")


async def upload_apartment_image(image: UploadFile) -> str:
    return await _upload_image(image, folder=APARTMENT_IMAGE_FOLDER, kind="apartment image")

async def upload_task_update_image(image: UploadFile) -> str:
    return await _upload_image(
        image,
        folder=TASK_UPDATE_IMAGE_FOLDER,
        kind="task update image",
    )
DOCUMENT_FILE_FOLDER = "/documents"


async def upload_document_file(file: UploadFile) -> str:
    return await _upload_file(
        file,
        folder=DOCUMENT_FILE_FOLDER,
        kind="document file",
    )