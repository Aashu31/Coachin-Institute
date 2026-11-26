import { useState, type FormEvent } from 'react';

import { api } from '../lib/api';
import { BUSINESS } from '../lib/business';
import type { LeadPreferredSlot, LeadTargetCourse } from '../lib/types';

function CheckIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.1c-.24.68-1.4 1.3-1.94 1.34-.5.04-.98.23-3.3-.69-2.78-1.1-4.55-3.92-4.69-4.1-.14-.18-1.12-1.49-1.12-2.84s.71-2.01.96-2.29c.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.24.57.8 1.95.87 2.09.07.14.12.31.02.49-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.37-.23.62-.14.25.09 1.6.75 1.88.89.28.14.46.21.53.32.07.12.07.68-.17 1.36z" />
    </svg>
  );
}

export interface ContactFormProps {
  initialCourse?: LeadTargetCourse;
}

export default function ContactForm({ initialCourse = 'CAT' }: ContactFormProps): JSX.Element {
  const [result, setResult] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState<LeadTargetCourse>(initialCourse);
  const [slot, setSlot] = useState<LeadPreferredSlot>('EVENING');
  const [message, setMessage] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setResult('Sending....');
    setSubmitting(true);

    const studentNameVal = name.trim();
    const phoneVal = phone.trim();
    const emailVal = email.trim();
    const courseVal = course;
    const slotVal = slot;
    const messageVal = message.trim();

    const formData = new FormData();
    formData.append('access_key', '807a84df-22b2-4cc8-bf5a-37c990ceb9b4');
    formData.append('name', studentNameVal);
    formData.append('email', emailVal);
    formData.append('phone', phoneVal);
    formData.append('course', courseVal === 'CLASS_12_PCM' ? 'Class 11–12 PCM' : 'CAT / MBA entrance');
    formData.append('slot', slotVal === 'MORNING' ? 'Morning · 8–11 AM' : slotVal === 'WEEKEND' ? 'Weekend' : 'Evening · 4–7 PM');
    formData.append('message', messageVal);
    formData.append('subject', `New Demo Class & Contact Form: ${studentNameVal} (${phoneVal})`);
    formData.append('from_name', 'P.D.O Classes Website');

    let web3Success = false;
    let platformSuccess = false;

    // Concurrently trigger Web3Forms submission and Institute Leads CRM registration
    const [web3Result, platformResult] = await Promise.allSettled([
      // 1. Web3Forms email notification (multipart FormData avoids CORS preflight blockage)
      (async () => {
        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          body: formData,
        });

        const text = await response.text();
        try {
          const data = JSON.parse(text);
          return Boolean(data && data.success);
        } catch {
          // If redirected or non-JSON success response
          return response.ok && (text.includes('success') || text.includes('Thank you'));
        }
      })(),

      // 2. Platform Leads database registration (ensures exact lead details are never lost)
      (async () => {
        if (studentNameVal && phoneVal.replace(/\D/g, '').length >= 10) {
          const leadRes = await api.createDemoLead({
            studentName: studentNameVal,
            phone: phoneVal,
            targetCourse: courseVal === 'CLASS_12_PCM' ? 'CLASS_12_PCM' : 'CAT',
            preferredSlot: slotVal === 'MORNING' ? 'MORNING' : slotVal === 'WEEKEND' ? 'WEEKEND' : 'EVENING',
            notes: emailVal ? `[Email: ${emailVal}] ${messageVal}`.trim() : (messageVal || undefined),
            instituteSlug: BUSINESS.instituteSlug,
          });
          return Boolean(leadRes && leadRes.leadId);
        }
        return false;
      })(),
    ]);

    if (web3Result.status === 'fulfilled' && web3Result.value) {
      web3Success = true;
    }
    if (platformResult.status === 'fulfilled' && platformResult.value) {
      platformSuccess = true;
    }

    setSubmitting(false);

    if (web3Success || platformSuccess) {
      setResult('Form Submitted Successfully');
      setIsSuccess(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } else {
      setResult('Error submitting form. Please check your connection or contact us on WhatsApp directly.');
      setIsSuccess(false);
    }
  };

  const resetForm = () => {
    setIsSuccess(false);
    setResult('');
    setName('');
    setEmail('');
    setPhone('');
    setMessage('');
  };

  if (isSuccess) {
    return (
      <div className="animate-fade-in text-center py-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckIcon className="h-8 w-8" />
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold text-slate-900">
          Form Submitted Successfully
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-md mx-auto">
          Thank you! We have received your details. Our team will contact you within 24 hours to confirm your seat.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={`https://wa.me/919835010000?text=${encodeURIComponent('Hi P.D.O Classes, I just submitted the form on your website.')}`}
            target="_blank"
            rel="noreferrer"
            className="btn-primary !bg-green-600 hover:!bg-green-700"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Message us on WhatsApp
          </a>
          <button
            type="button"
            onClick={resetForm}
            className="btn-secondary"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="student-name" className="field-label">
          Student Name <span className="text-red-500">*</span>
        </label>
        <input
          id="student-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aditya Mahto"
          className="input-field"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="field-label">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="phone" className="field-label">
            Parent / Student Mobile <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            className="input-field"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="target-course" className="field-label">
            Course Track
          </label>
          <select
            id="target-course"
            name="course"
            value={course}
            onChange={(e) => setCourse(e.target.value as LeadTargetCourse)}
            className="input-field"
          >
            <option value="CAT">CAT / MBA entrance</option>
            <option value="CLASS_12_PCM">Class 11–12 PCM</option>
          </select>
        </div>

        <div>
          <label htmlFor="preferred-slot" className="field-label">
            Preferred Slot
          </label>
          <select
            id="preferred-slot"
            name="slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value as LeadPreferredSlot)}
            className="input-field"
          >
            <option value="MORNING">Morning · 8–11 AM</option>
            <option value="EVENING">Evening · 4–7 PM</option>
            <option value="WEEKEND">Weekend</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="field-label">
          Message / Anything we should know? <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={3}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Current class, target exam, preferred days or queries…"
          className="input-field resize-none"
        />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Sending....' : 'Submit Form'}
      </button>

      {result ? (
        <p
          className={`text-center text-xs font-semibold ${
            result === 'Form Submitted Successfully'
              ? 'text-green-700'
              : result === 'Sending....'
              ? 'text-blue-700'
              : 'text-red-600'
          }`}
        >
          {result}
        </p>
      ) : null}

      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        Your number and email are used only to confirm this request. We never publish contact details.
      </p>
    </form>
  );
}
