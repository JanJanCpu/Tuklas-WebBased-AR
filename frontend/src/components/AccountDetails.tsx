import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronRight, UserRound, X } from "lucide-react";
import { ApiError, changeMyPassword, fetchMyAccount } from "../lib/api";
import { cacheAccount, getToken } from "../lib/auth";
import type { AuthUser } from "../types/domain";

export function AccountDetails({ user }: { user: AuthUser }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [account, setAccount] = useState(user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("next"));
    if (next !== String(data.get("confirm"))) { setPasswordStatus("The new passwords do not match."); return; }
    setPasswordSaving(true);
    setPasswordStatus("");
    try {
      await changeMyPassword(String(data.get("current")), next);
      form.reset();
      setPasswordStatus("Password changed. Use the new password next time you log in.");
    } catch (cause) {
      setPasswordStatus(cause instanceof ApiError ? cause.message : "You need internet to change your password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  useEffect(() => { setAccount(user); }, [user]);

  useEffect(() => {
    if (user.role !== "student") return;
    let cancelled = false;
    const token = getToken();
    const refresh = async () => {
      if (cancelled) return;
      setError("");
      if (!token) {
        setError("Sign in again to load your account details.");
        return;
      }
      setLoading(true);
      try {
        const result = await fetchMyAccount();
        if (cancelled || getToken() !== token) return;
        if (result.user?.id !== user.id) {
          throw new Error("Account response did not match the signed-in user.");
        }
        // teacherName/sectionName default to null (shown as "Not assigned") rather than
        // failing the whole request, since a student legitimately may not have either yet.
        const nextAccount = { ...result.user, teacherName: result.user.teacherName ?? null, sectionName: result.user.sectionName ?? null };
        setAccount(nextAccount);
        cacheAccount(token, nextAccount);
      } catch (cause) {
        if (cancelled || getToken() !== token) return;
        // Keep cached enrollment, but distinguish a server failure from being offline.
        setError(cause instanceof ApiError
          ? (cause.status === 404
            ? "Account details are unavailable from the server. Please try again later."
            : "The server could not load your account details. Please try again.")
          : !navigator.onLine
            ? "You're offline. Reconnect to refresh your account details."
            : "Unable to load your account details. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    window.addEventListener("online", refresh);
    return () => { cancelled = true; window.removeEventListener("online", refresh); };
  }, [user.id, user.role, refreshVersion]);

  const enrollmentLabel = (value: string | null | undefined) => value === undefined
    ? (loading ? "Loading…" : "Not available")
    : value || "Not assigned";
  const role = user.role === "teacher" ? "Teacher" : "Student";
  const createdAt = new Date(user.createdAt);
  const joined = Number.isNaN(createdAt.getTime()) ? "Not available" : createdAt.toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <button
        type="button"
        className="account-indicator"
        aria-label={`View account details for ${user.name} (@${user.username}), ${role}`}
        aria-haspopup="dialog"
        onClick={() => { dialog.current?.showModal(); setRefreshVersion(current => current + 1); }}
      >
        <span className="account-avatar" aria-hidden="true"><UserRound size={20} /></span>
        <span className="account-identity">
          <strong>{user.name}</strong>
          <span>@{user.username}</span>
        </span>
        <span className="account-details-label"><strong>{role}</strong></span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <dialog ref={dialog} className="account-dialog" aria-labelledby="account-details-title">
        <div className="account-dialog-heading">
          <h2 id="account-details-title">Account details</h2>
          <button type="button" className="account-close" aria-label="Close account details" onClick={() => dialog.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <dl className="account-fields">
          <div><dt>Full name</dt><dd>{user.name}</dd></div>
          <div><dt>Username</dt><dd>@{user.username}</dd></div>
          <div><dt>Account type</dt><dd>{role}</dd></div>
          {user.role === "student" && <>
            <div><dt>Teacher</dt><dd>{enrollmentLabel(account.teacherName)}</dd></div>
            <div><dt>Section / Class</dt><dd>{enrollmentLabel(account.sectionName)}</dd></div>
          </>}
          <div><dt>Account created</dt><dd>{joined}</dd></div>
        </dl>
        <details className="change-password">
          <summary>Change password</summary>
          <form className="auth-form" onSubmit={handleChangePassword}>
            <label className="field-label">Current password<input name="current" type="password" autoComplete="current-password" required /></label>
            <label className="field-label">New password<input name="next" type="password" autoComplete="new-password" required minLength={8} /></label>
            <label className="field-label">Confirm new password<input name="confirm" type="password" autoComplete="new-password" required minLength={8} /></label>
            {passwordStatus && <p role="status">{passwordStatus}</p>}
            <button className="primary-button" type="submit" disabled={passwordSaving}>{passwordSaving ? "Saving..." : "Save New Password"}</button>
            {user.role === "student" && <p className="muted">Forgot it later? Your teacher can give you a new one.</p>}
          </form>
        </details>
        {user.role === "student" && error && <div role="status">
          <p>{error}</p>
          <button type="button" disabled={loading} onClick={() => setRefreshVersion(current => current + 1)}>
            {loading ? "Loading…" : "Try again"}
          </button>
        </div>}
      </dialog>
    </>
  );
}
