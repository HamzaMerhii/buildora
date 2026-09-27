'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X, Send } from 'lucide-react';
import GlowButton from '@/components/public/ui/GlowButton';
import { submitPublicApartmentInterest } from '@/lib/api/public.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';

type Props = {
  open: boolean;
  onClose: () => void;
  apartmentId: string;
  apartmentName: string;
  companyName: string;
};

type Errors = { name?: string; email?: string; phone?: string; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9][0-9\s\-()]{5,}$/;

export default function InterestDialog({ open, onClose, apartmentId, apartmentName, companyName }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (open) {
      dialog?.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialog?.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open ]);

  function handleClose() {
    setErrors({});
    setFormError(null);
    setSent(false);
    setSubmitting(false);
    onClose();
  }

  function validate(form: HTMLFormElement): { values: Record<string, string>; errors: Errors } {
    const data = new FormData(form);
    const values = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
    };
    const next: Errors = {};
    if (values.name.length < 2) next.name = 'Please enter your full name.';
    if (!EMAIL_RE.test(values.email)) next.email = 'Please enter a valid email address.';
    if (!PHONE_RE.test(values.phone)) next.phone = 'Please enter a valid phone number.';
    if (values.message.length > 500) next.message = 'Message must be under 500 characters.';
    return { values, errors: next };
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const { values, errors: next } = validate(e.currentTarget);
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      await submitPublicApartmentInterest(apartmentId, {
        name: values.name,
        phone: values.phone,
        email: values.email,
        message: values.message ? values.message : undefined,
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setFormError('This residence is no longer available. Please explore other residences.');
      } else if (err instanceof ApiError && err.status === 422) {
        setFormError('Some details look invalid. Please review the form and try again.');
      } else {
        setFormError(friendlyMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return <dialog ref={ref} className="project-dialog interest-dialog" onCancel={handleClose} onClick={e => { if (e.target === e.currentTarget) handleClose(); }} aria-labelledby="interest-title">
    <div className="dialog-inner">
      <button className="close-dialog" onClick={handleClose} aria-label="Close interest request"><X /></button>
      <h2 id="interest-title">I&rsquo;m Interested</h2>
      <p className="interest-context">{apartmentName} · {companyName}</p>
      {sent ? (
        <div>
          <p className="saved-message" role="status">
            Thank you. Your interest in {apartmentName} has been submitted successfully.
          </p>
          <p className="form-note">{companyName} will follow up with availability and viewing times.</p>
          <GlowButton type="button" onClick={handleClose}>Done</GlowButton>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit}>
          <label>Full name
            <input name="name" autoComplete="name" placeholder="Full name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'interest-name-error' : undefined} />
            {errors.name && <span id="interest-name-error" className="field-error" role="alert">{errors.name}</span>}
          </label>
          <label>Email
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'interest-email-error' : undefined} />
            {errors.email && <span id="interest-email-error" className="field-error" role="alert">{errors.email}</span>}
          </label>
          <label>Phone number
            <input name="phone" type="tel" autoComplete="tel" placeholder="+961 ..." aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'interest-phone-error' : undefined} />
            {errors.phone && <span id="interest-phone-error" className="field-error" role="alert">{errors.phone}</span>}
          </label>
          <label>Message <span className="optional">(optional)</span>
            <textarea name="message" rows={3} maxLength={500} placeholder="Preferred visit times, questions…" aria-invalid={!!errors.message} aria-describedby={errors.message ? 'interest-message-error' : undefined} />
            {errors.message && <span id="interest-message-error" className="field-error" role="alert">{errors.message}</span>}
          </label>
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <p className="form-note">Your contact details will be shared with {companyName} so they can respond to your inquiry.</p>
          <GlowButton type="submit" disabled={submitting}><Send size={15} /> {submitting ? 'Sending…' : 'Send Interest Request'}</GlowButton>
        </form>
      )}
    </div>
  </dialog>;
}
