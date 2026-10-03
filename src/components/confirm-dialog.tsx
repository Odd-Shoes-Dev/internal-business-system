'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'default';
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let openDialog: ((p: Pending) => void) | null = null;

// In-app replacement for window.confirm(). Use it as `if (!(await confirmDialog('...'))) return;`.
// Pass just the message and the wording is worked out from it: messages about deleting,
// voiding, removing, rejecting or cancelling get a red button that names the action.
export function confirmDialog(options: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  return new Promise((resolve) => {
    if (!openDialog) {
      // Host not mounted (should not happen); fall back so the action is never silently skipped.
      resolve(typeof window !== 'undefined' ? window.confirm(opts.message) : false);
      return;
    }
    openDialog({ ...opts, resolve });
  });
}

const ACTIONS: Array<[RegExp, string]> = [
  [/\bdelete\b/i, 'Delete'],
  [/\bvoid\b/i, 'Void'],
  [/\bremove\b/i, 'Remove'],
  [/\breject\b/i, 'Reject'],
  [/\bcancel\b/i, 'Yes, cancel'],
];

function describe(opts: ConfirmOptions) {
  const action = ACTIONS.find(([re]) => re.test(opts.message));
  const danger = opts.tone ? opts.tone === 'danger' : !!action;
  return {
    danger,
    title: opts.title ?? (danger ? 'Are you sure?' : 'Please confirm'),
    confirmText: opts.confirmText ?? (action ? action[1] : 'Confirm'),
    cancelText: opts.cancelText ?? (action?.[1] === 'Yes, cancel' ? 'Keep it' : 'Cancel'),
  };
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    openDialog = (p) => {
      setPending(p);
      setOpen(true);
    };
    return () => {
      openDialog = null;
    };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setOpen(false);
  };

  const view = pending ? describe(pending) : null;

  return (
    <Transition show={open} as={Fragment} afterLeave={() => setPending(null)}>
      <Dialog as="div" className="relative z-[60]" onClose={() => close(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              {view && (
                <>
                  <div className="flex gap-4">
                    <div
                      className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${
                        view.danger ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-700'
                      }`}
                    >
                      {view.danger ? (
                        <ExclamationTriangleIcon className="h-6 w-6" />
                      ) : (
                        <QuestionMarkCircleIcon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Dialog.Title className="text-base font-semibold text-gray-900">
                        {view.title}
                      </Dialog.Title>
                      <Dialog.Description className="mt-1 whitespace-pre-line text-sm text-gray-600">
                        {pending?.message}
                      </Dialog.Description>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => close(false)}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {view.cancelText}
                    </button>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => close(true)}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                        view.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
                      }`}
                    >
                      {view.confirmText}
                    </button>
                  </div>
                </>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
