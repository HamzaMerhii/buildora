from fastapi_mail import (
    ConnectionConfig,
    FastMail,
    MessageSchema,
    MessageType,
)

from app.core.config import settings


mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER,
    MAIL_PASSWORD=settings.SMTP_PASSWORD,
    MAIL_FROM=settings.FROM_EMAIL,
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,

    MAIL_STARTTLS=False,
    MAIL_SSL_TLS=True,

    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)


async def send_password_reset_email(
    to_email: str,
    user_name: str,
    reset_link: str,
):
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>

    <body style="
        font-family: Arial, sans-serif;
        background-color: #f3f4f6;
        padding: 30px;
    ">

        <div style="
            max-width: 600px;
            margin: auto;
            background: white;
            padding: 32px;
            border-radius: 10px;
        ">

            <h2 style="
                color: #111827;
                margin-bottom: 20px;
            ">
                Reset your Buildora password
            </h2>

            <p>
                Hello {user_name},
            </p>

            <p>
                We received a request to reset the password
                for your Buildora account.
            </p>

            <p>
                Click the button below to create a new password.
            </p>

            <div style="
                text-align: center;
                margin: 30px 0;
            ">
                <a
                    href="{reset_link}"
                    style="
                        display: inline-block;
                        background-color: #F59E0B;
                        color: white;
                        padding: 14px 24px;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: bold;
                    "
                >
                    Reset Password
                </a>
            </div>

            <p>
                This link expires in 15 minutes.
            </p>

            <p>
                If you did not request a password reset,
                you can safely ignore this email.
            </p>

            <hr style="
                margin: 30px 0;
                border: 0;
                border-top: 1px solid #e5e7eb;
            ">

            <p style="
                color: #6b7280;
                font-size: 12px;
            ">
                Buildora
            </p>

        </div>

    </body>
    </html>
    """

    message = MessageSchema(
        subject="Reset your Buildora password",
        recipients=[to_email],
        body=html,
        subtype=MessageType.html,
    )

    fm = FastMail(mail_config)

    await fm.send_message(message)