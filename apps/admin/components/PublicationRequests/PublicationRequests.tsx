"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import {
  REQUEST_NOTE_MAX,
  requestKindsFor,
  type PublicationRequest,
  type RequestResult,
} from "@/lib/admin/complexes/requests";
import type { PublicationStatus } from "@/lib/admin/publication";
import { formatDate } from "@vh/shared/format";

type RequestAction = (formData: FormData) => Promise<RequestResult>;

type PublicationRequestsProps = {
  complex: { id: string; status: PublicationStatus };
  /** Руководитель отвечает, менеджер просит (PLAN §10, п. 25). */
  role: "head" | "manager";
  viewerId: string;
  requests: readonly PublicationRequest[];
  actions: { request: RequestAction | null; cancel: RequestAction | null; decline: RequestAction | null };
};

const IDLE: RequestResult = { status: "idle" };

/** «Запросы руководителю» во вкладке «Публикация»: открытый запрос, кнопки по роли, история. */
export function PublicationRequests({ complex, role, viewerId, requests, actions }: PublicationRequestsProps) {
  const pending = requests.find((request) => request.status === "pending") ?? null;
  const history = requests.filter((request) => request.status !== "pending");
  return (
    <div className="publication-requests">
      {pending ? (
        <PendingRequest
          request={pending}
          cancel={role === "manager" && pending.requestedBy === viewerId ? actions.cancel : null}
          decline={role === "head" ? actions.decline : null}
        />
      ) : null}
      {role === "manager" && actions.request ? (
        <RequestForm complex={complex} action={actions.request} pendingKind={pending?.kind ?? null} />
      ) : null}
      {history.length > 0 ? <RequestHistory requests={history} /> : null}
    </div>
  );
}

function useRequestState(action: RequestAction) {
  return useActionState((_previous: RequestResult, formData: FormData) => action(formData), IDLE);
}

function ErrorLine({ state }: { state: RequestResult }) {
  const t = useTranslations("admin.complexes.requests");
  const errors = useTranslations("admin.developers.errors");
  if (state.status !== "error") return null;
  const own = state.error === "noteTooLong" || state.error === "answerRequired";
  return (
    <FormStatus tone="error">
      {own ? t(`errors.${state.error as "noteTooLong"}`) : errors(state.error as "unknown")}
    </FormStatus>
  );
}

type PendingRequestProps = {
  request: PublicationRequest;
  cancel: RequestAction | null;
  decline: RequestAction | null;
};

function PendingRequest({ request, cancel, decline }: PendingRequestProps) {
  const t = useTranslations("admin.complexes.requests");
  return (
    <div className="publication-requests__pending">
      <p className="publication-requests__waiting">
        {t("waiting", {
          kind: t(`kindShort.${request.kind}`),
          who: request.requesterName ?? t("nobody"),
          when: formatDate(new Date(request.requestedAt)),
        })}
      </p>
      {request.note ? <p className="publication-requests__note">{t("noteShown", { note: request.note })}</p> : null}
      {decline ? <p className="publication-requests__hint">{t("approveHint")}</p> : null}
      {cancel ? <CancelForm request={request} action={cancel} /> : null}
      {decline ? <DeclineForm request={request} action={decline} /> : null}
    </div>
  );
}

function CancelForm({ request, action }: { request: PublicationRequest; action: RequestAction }) {
  const t = useTranslations("admin.complexes.requests");
  const [state, formAction, pending] = useRequestState(action);
  return (
    <form action={formAction} className="publication-requests__row">
      <input type="hidden" name="request" value={request.id} />
      <Button type="submit" size="sm" variant="ghost" pending={pending}>
        {t("cancel")}
      </Button>
      {state.status === "done" ? <FormStatus tone="success">{t("cancelled")}</FormStatus> : null}
      <ErrorLine state={state} />
    </form>
  );
}

function DeclineForm({ request, action }: { request: PublicationRequest; action: RequestAction }) {
  const t = useTranslations("admin.complexes.requests");
  const [state, formAction, pending] = useRequestState(action);
  return (
    <form action={formAction} className="publication-requests__form">
      <input type="hidden" name="request" value={request.id} />
      <Field
        id={`decline-${request.id}`}
        name="answer"
        label={t("declineAnswer")}
        maxLength={REQUEST_NOTE_MAX}
        autoComplete="off"
        required
      />
      <div className="publication-requests__row">
        <Button type="submit" size="sm" variant="danger" pending={pending}>
          {pending ? t("pending") : t("declineSubmit")}
        </Button>
        {state.status === "done" ? <FormStatus tone="success">{t("declined")}</FormStatus> : null}
        <ErrorLine state={state} />
      </div>
    </form>
  );
}

type RequestFormProps = {
  complex: { id: string; status: PublicationStatus };
  action: RequestAction;
  /** Уже открытый запрос: повтор того же вида не нужен. */
  pendingKind: string | null;
};

/** Менеджер: «Запросить публикацию» / «скрытие» / «возврат» / «архив» с короткой причиной. */
function RequestForm({ complex, action, pendingKind }: RequestFormProps) {
  const t = useTranslations("admin.complexes.requests");
  const tp = useTranslations("admin.complexes.publication");
  const [state, formAction, pending] = useRequestState(action);
  const kinds = requestKindsFor(complex.status).filter((kind) => kind !== pendingKind);
  if (kinds.length === 0) return null;
  return (
    <form action={formAction} className="publication-requests__form">
      <p className="publication-requests__lead">{tp("managerLead")}</p>
      <input type="hidden" name="id" value={complex.id} />
      <Field
        id="request-note"
        name="note"
        label={t("note")}
        placeholder={t("notePlaceholder")}
        maxLength={REQUEST_NOTE_MAX}
        autoComplete="off"
      />
      <div className="publication-requests__row">
        {kinds.map((kind) => (
          <Button
            key={kind}
            type="submit"
            name="kind"
            value={kind}
            size="sm"
            variant={kind === "archive" ? "ghost" : "primary"}
            pending={pending}
          >
            {t(`kinds.${kind}`)}
          </Button>
        ))}
      </div>
      {state.status === "done" ? (
        <FormStatus tone={state.notified === false ? "notice" : "success"}>
          {state.notified === false ? t("sentNoBot") : t("sent")}
        </FormStatus>
      ) : null}
      <ErrorLine state={state} />
    </form>
  );
}

function RequestHistory({ requests }: { requests: readonly PublicationRequest[] }) {
  const t = useTranslations("admin.complexes.requests");
  return (
    <ul className="publication-requests__history">
      {requests.map((request) => (
        <li
          key={request.id}
          className={`publication-requests__item publication-requests__item--${request.status}`}
        >
          <span className="publication-requests__item-head">
            {t(`history.${request.status as "done"}`)} · {t(`kindShort.${request.kind}`)} ·{" "}
            {request.requesterName ?? t("nobody")}, {formatDate(new Date(request.requestedAt))}
          </span>
          {request.note ? <span>{t("noteShown", { note: request.note })}</span> : null}
          {request.answer ? (
            <span className="publication-requests__answer">{t("answer", { answer: request.answer })}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
