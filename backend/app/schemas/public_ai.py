from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field


# -----------------------------------
# INTENTS
# -----------------------------------

class PublicAIIntent(str, Enum):
    APARTMENT_SEARCH = "APARTMENT_SEARCH"
    UNKNOWN = "UNKNOWN"


# -----------------------------------
# FILTERS
# -----------------------------------

class PublicApartmentSearchFilters(BaseModel):
    location: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    company_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    project_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    bedrooms: Optional[int] = Field(
        default=None,
        ge=0,
    )

    bathrooms: Optional[int] = Field(
        default=None,
        ge=0,
    )

    min_price: Optional[float] = Field(
        default=None,
        ge=0,
    )

    max_price: Optional[float] = Field(
        default=None,
        ge=0,
    )

    min_area: Optional[float] = Field(
        default=None,
        ge=0,
    )

    max_area: Optional[float] = Field(
        default=None,
        ge=0,
    )


# -----------------------------------
# PARSED QUERIES
# -----------------------------------

class ParsedPublicApartmentSearchQuery(BaseModel):
    intent: Literal[
        PublicAIIntent.APARTMENT_SEARCH
    ]

    filters: PublicApartmentSearchFilters = Field(
        default_factory=PublicApartmentSearchFilters
    )


class ParsedPublicUnknownQuery(BaseModel):
    intent: Literal[
        PublicAIIntent.UNKNOWN
    ]

    filters: None = None


ParsedPublicAIQuery = Annotated[
    Union[
        ParsedPublicApartmentSearchQuery,
        ParsedPublicUnknownQuery,
    ],
    Field(discriminator="intent"),
]


# -----------------------------------
# REQUEST
# -----------------------------------

class PublicAISearchRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
    )


# -----------------------------------
# RESULT
# -----------------------------------

class PublicApartmentResult(BaseModel):
    id: str

    unit_number: str

    price: Optional[float] = None
    area_sqm: Optional[float] = None

    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None

    status: str

    image: Optional[str] = None

    project_id: str
    project_name: str

    company_id: str
    company_name: str

    location: Optional[str] = None


# -----------------------------------
# RESPONSE
# -----------------------------------

class PublicAISearchResponse(BaseModel):
    query: str

    intent: PublicAIIntent

    filters: Optional[
        PublicApartmentSearchFilters
    ] = None

    answer: str

    count: int

    results: list[PublicApartmentResult]