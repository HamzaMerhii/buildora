import resend

from app.core.config import settings


resend.api_key = settings.RESEND_API_KEY


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

    params: resend.Emails.SendParams = {
        "from": (
            f"{settings.MAIL_FROM_NAME} "
            f"<{settings.FROM_EMAIL}>"
        ),
        "to": [to_email],
        "subject": "Reset your Buildora password",
        "html": html,
    }

    return await resend.Emails.send_async(params)