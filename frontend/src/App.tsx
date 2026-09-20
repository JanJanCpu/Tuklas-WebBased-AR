import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ApiError, createSection, createSectionStudent, fetchClassProgress, fetchModules, fetchMyRecords, getSection, listSections, login as apiLogin, registerTeacher, resetStudentProgress, submitFeedback, syncRecords } from "./lib/api";
import { clearSession, getStoredUser, getToken, getSessionNotice, setSession, subscribeSession } from "./lib/auth";
import { createRecordSession } from "./lib/record-session";
import { prepareOfflineFiles } from "./lib/offline";
import { modules as fallbackModules } from "./data/modules";
import { getObservationModel, getObservationDefaults, formatControlValue, initialLabState } from "./lib/experiments";
import { ExperimentControls } from "./components/ExperimentControls";
import { AccountDetails } from "./components/AccountDetails";
import type { ActivityRecord, AuthUser, ClassProgressRecord, Feedback, LearningModule, Role, Screen, Section, SectionSummary, Stage, ViewMode } from "./types/domain";
import { Activity, CircuitBoard, Download, Earth, Microscope, Printer, Thermometer, type LucideIcon } from "lucide-react";

// three.js (pulled in by ScienceScene) is a heavy dependency that only the
// Observe screen and its fallback 3D preview need - lazy-loading it keeps
// three.js out of the initial bundle everyone downloads just to log in and
// read Predict questions.
const ScienceScene = lazy(() => import("./components/ScienceScene").then((module) => ({ default: module.ScienceScene })));

// A module counts as "done" once all three of these stages have a
// submitted record. Reflection is intentionally excluded - it's an
// optional bonus, not part of the locked Predict/Observe/Explain flow.
const REQUIRED_STAGES: Stage[] = ["Predict", "Observe", "Explain"];

// How often "live" views (teacher's Class Progress and Section roster, a
// student's own reconciled progress) re-fetch while on screen and online,
// so a teacher sees new submissions - and a reset student sees their
// screen unlock - without needing to navigate away and back.
const LIVE_REFRESH_MS = 15000;

// Not yet part of lib.dom.d.ts; Chrome/Edge-only event carrying the deferred
// install prompt (see the beforeinstallprompt listener below).
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function stagesFor(recordsList: ActivityRecord[], moduleId: string): Set<Stage> {
  return new Set(recordsList.filter((record) => record.moduleId === moduleId).map((record) => record.stage));
}

interface ExperimentTrial {
  id: number;
  values: string[];
}

const moduleIcons: Record<string, LucideIcon> = {
  motion: Activity,
  electricity: CircuitBoard,
  materials: Thermometer,
  life: Microscope,
  "earth-space": Earth,
};

function ModuleIcon({ moduleId }: { moduleId: string }) {
  const Icon = moduleIcons[fallbackModules.find(item => item.id === moduleId)?.groupId || moduleId] || Activity;
  return <span className="module-icon" aria-hidden="true"><Icon size={24} strokeWidth={2.2} /></span>;
}

function App() {
  const token = useSyncExternalStore(subscribeSession, getToken);
  // Remount all account-owned state, forms, feedback and request effects.
  return <Workspace key={token || "signed-out"} user={token ? getStoredUser() : null} />;
}

function Workspace({ user }: { user: AuthUser | null }) {
  const recordSession = useRef<ReturnType<typeof createRecordSession> | null>(null);
  const pendingSaves = useRef(new Set<string>());
  const role: Role | "" = user?.role ?? "";
  const isTeacherPreview = role === "teacher";
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [authError, setAuthError] = useState(getSessionNotice);
  const [authLoading, setAuthLoading] = useState(false);
  const [students, setStudents] = useState<AuthUser[]>([]);
  const [classRecords, setClassRecords] = useState<ClassProgressRecord[]>([]);
  const [studentUsername, setStudentUsername] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentFormError, setStudentFormError] = useState("");
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [sectionStudents, setSectionStudents] = useState<AuthUser[]>([]);
  const [sectionRecords, setSectionRecords] = useState<ClassProgressRecord[]>([]);
  const [sectionFeedback, setSectionFeedback] = useState<Feedback[]>([]);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [gradingStudent, setGradingStudent] = useState<AuthUser | null>(null);
  const [gradingModuleId, setGradingModuleId] = useState<string | null>(null);
  const [feedbackScore, setFeedbackScore] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackFormError, setFeedbackFormError] = useState("");
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [sectionFormError, setSectionFormError] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [history, setHistory] = useState<Screen[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [lab, setLab] = useState(initialLabState);
  const [markerDetected, setMarkerDetected] = useState(false);
  const [modules, setModules] = useState<LearningModule[]>(fallbackModules);
  const [activeModule, setActiveModuleState] = useState<LearningModule>(fallbackModules[0]);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPredictions, setSelectedPredictions] = useState<string[]>([]);
  const [predictionNote, setPredictionNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [explanation, setExplanation] = useState("");
  const [reflection, setReflection] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("tuklas-view-mode") as ViewMode | null) || "ar");
  const [controlA, setControlA] = useState(0);
  const [controlB, setControlB] = useState(0);
  const [trialPulse, setTrialPulse] = useState(0);
  const [experimentTrials, setExperimentTrials] = useState<ExperimentTrial[]>([]);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineStatus, setOfflineStatus] = useState("Cache app shell, twelve experiments, marker, and local records support.");
  const [deviceStatus, setDeviceStatus] = useState("Camera, WebGL, service worker, and storage readiness.");
  const [cameraStatus, setCameraStatus] = useState("Camera is off.");
  const [cameraReady, setCameraReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  const visibleModules = useMemo(
    () => modules.filter((item) => `${item.title} ${item.subtitle} ${item.quarter} ${item.moduleTitle}`.toLowerCase().includes(query.toLowerCase())),
    [modules, query],
  );
  // A student's real progress, derived straight from their own submitted
  // records (local + synced) instead of a separate, driftable flag store.
  // Once a stage has a submitted record, it's locked against re-access for
  // students (a teacher can undo this - see "Reset Progress" in Classes).
  const activeModuleStages = stagesFor(records, activeModule.id);
  const predictLocked = !isTeacherPreview && activeModuleStages.has("Predict");
  const observeLocked = !isTeacherPreview && activeModuleStages.has("Observe");
  const explainLocked = !isTeacherPreview && activeModuleStages.has("Explain");
  const predictionReview = records.find((record) => record.moduleId === activeModule.id && record.stage === "Predict")?.text || "";
  const existingExplainText = records.find((record) => record.moduleId === activeModule.id && record.stage === "Explain")?.text || "";
  const activeModuleFeedback = myFeedback.find((entry) => entry.moduleId === activeModule.id);
  const percent = Math.round((REQUIRED_STAGES.filter((stage) => activeModuleStages.has(stage)).length / REQUIRED_STAGES.length) * 100);
  const moduleProgress = modules.map((module) => {
    const stages = stagesFor(records, module.id);
    const completed = REQUIRED_STAGES.filter((stage) => stages.has(stage)).length;
    const grade = myFeedback.find((entry) => entry.moduleId === module.id);
    return { module, completed, percent: Math.round((completed / REQUIRED_STAGES.length) * 100), stages, grade };
  });
  const overallCompleted = moduleProgress.reduce((total, item) => total + item.completed, 0);
  const overallTotal = modules.length * REQUIRED_STAGES.length;
  const overallPercent = overallTotal ? Math.round((overallCompleted / overallTotal) * 100) : 0;
  const completedModules = moduleProgress.filter((item) => item.completed === REQUIRED_STAGES.length);
  const startedModules = moduleProgress.filter((item) => item.completed > 0 && item.completed < REQUIRED_STAGES.length);
  const notStartedModules = moduleProgress.filter((item) => item.completed === 0);
  const observationModel = getObservationModel(activeModule.id, controlA, controlB, lab);
  const classSummary = useMemo(() => {
    return students.map((student) => {
      const studentRecords = classRecords.filter((record) => record.userId === student.id);
      const completedStages = modules.reduce((sum, module) => {
        const stages = new Set(studentRecords.filter((record) => record.moduleId === module.id).map((record) => record.stage));
        return sum + REQUIRED_STAGES.filter((stage) => stages.has(stage)).length;
      }, 0);
      const totalPossible = modules.length * REQUIRED_STAGES.length;
      return {
        student,
        recordCount: studentRecords.length,
        percent: totalPossible ? Math.round((completedStages / totalPossible) * 100) : 0,
      };
    });
  }, [students, classRecords, modules]);

  useEffect(() => {
    fetchModules().then(items => { if (items.length === fallbackModules.length && items.every(item => item.groupId && fallbackModules.some(local => local.id === item.id))) setModules(items); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    const session = createRecordSession({
      userId: user.id,
      isCurrent: () => getToken() === token,
      upload: syncRecords,
      fetch: fetchMyRecords,
      onRecords: setRecords,
      onFeedback: setMyFeedback,
    });
    recordSession.current = session;
    session.load().catch(() => showToast("Could not load saved work. Check browser storage."));
    return () => { session.stop(); recordSession.current = null; };
  }, [user?.id]);

  // Keep resets and feedback live on every activity screen. Pulls and
  // uploads share a queue; saving locally never waits for the network.
  useEffect(() => {
    if (!online || !user) return;
    const session = recordSession.current;
    const refresh = () => {
      session?.reconcile().catch(() => undefined);
      session?.sync().catch(() => undefined);
    };
    refresh();
    const interval = window.setInterval(refresh, LIVE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [online, user?.id]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Chrome's own install banner/menu item is unreliable across OEM browser
  // builds (e.g. budget-device MIUI Chrome); capture the event ourselves so
  // Settings can offer an explicit "Install App" button instead.
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) {
      setInstalled(true);
    }
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  useEffect(() => {
    localStorage.setItem("tuklas-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!online || !(screen === "home" && role === "teacher")) return;

    let cancelled = false;
    const load = () => {
      fetchClassProgress()
        .then((result) => {
          if (cancelled) return;
          setStudents(result.students);
          setClassRecords(result.records);
        })
        .catch(() => undefined);
    };

    load();
    const interval = window.setInterval(load, LIVE_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [online, screen, role]);

  useEffect(() => {
    if (screen === "classes" && role === "teacher") {
      listSections().then((result) => setSections(result.sections)).catch(() => undefined);
    }
  }, [screen, role]);

  useEffect(() => {
    if (!online || !(screen === "section" && activeSectionId)) return;

    let cancelled = false;
    const load = () => {
      getSection(activeSectionId)
        .then((result) => {
          if (cancelled) return;
          setActiveSection(result.section);
          setSectionStudents(result.students);
          setSectionRecords(result.records);
          setSectionFeedback(result.feedback);
        })
        .catch(() => undefined);
    };

    load();
    const interval = window.setInterval(load, LIVE_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [online, screen, activeSectionId]);

  useEffect(() => {
    document.body.classList.toggle("login-open", !role);
  }, [role]);

  useEffect(() => {
    const defaults = getObservationDefaults(activeModule.id);
    setLab(initialLabState());
    setMarkerDetected(false);
    setControlA(defaults.controlA);
    setControlB(defaults.controlB);
    setTrialPulse(0);
    setExperimentTrials([]);
    setPredictionNote("");
    setEvidence("");
    setExplanation("");
    setReflection("");

    if (isTeacherPreview) {
      // Teacher Preview answers Predict and Explain correctly up front so a
      // teacher can walk through the "ideal" run without re-deriving the
      // science each time. Observe stays fully manual (see below).
      setSelectedPredictions(activeModule.predictions.map((prediction) => prediction.choices[0]));
      setEvidence(getObservationModel(activeModule.id, defaults.controlA, defaults.controlB).recordText);
      setExplanation(activeModule.overview);
    } else {
      setSelectedPredictions([]);
    }
  }, [activeModule.id, isTeacherPreview]);

  function setActiveModule(module: LearningModule) {
    const defaults = getObservationDefaults(module.id);
    setControlA(defaults.controlA);
    setControlB(defaults.controlB);
    setLab(initialLabState());
    setActiveModuleState(module);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function goTo(nextScreen: Screen, push = true) {
    if (nextScreen === "modules" && push) { setSelectedQuarter(null); setSelectedGroup(null); setQuery(""); }
    if (push && screen !== nextScreen) setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    if (screen === "modules" && selectedGroup) { setSelectedGroup(null); return; }
    if (screen === "modules" && selectedQuarter) { setSelectedQuarter(null); return; }
    const previous = history.at(-1) || "home";
    setHistory((current) => current.slice(0, -1));
    goTo(previous, false);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const result = await apiLogin(loginUsername.trim(), loginPassword);
      setSession(result.token, result.user);
      setLoginPassword("");
      showToast(result.user.role === "teacher" ? "Teacher Mode opened." : "Student Mode opened.");
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : "Login failed. Check your connection.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleTeacherSignup(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const result = await registerTeacher(signupUsername.trim(), signupPassword, signupName.trim());
      setSession(result.token, result.user);
      setSignupPassword("");
      showToast("Teacher account created.");
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : "Sign up failed. Check your connection.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreateSection(event: FormEvent) {
    event.preventDefault();
    setSectionFormError("");
    if (!newSectionName.trim()) {
      setSectionFormError("Section name is required.");
      return;
    }
    try {
      const result = await createSection(newSectionName.trim());
      setSections((current) => [{ ...result.section, studentCount: 0 }, ...current]);
      setNewSectionName("");
      showToast(`Section "${result.section.name}" created.`);
    } catch (error) {
      setSectionFormError(error instanceof ApiError ? error.message : "Could not create section.");
    }
  }

  function openSection(sectionId: string) {
    setActiveSectionId(sectionId);
    setActiveSection(null);
    setSectionStudents([]);
    setSectionRecords([]);
    setSectionFeedback([]);
    setExpandedStudentId(null);
    setShowAddStudent(false);
    goTo("section");
  }

  // Clears a student's own submitted records - all modules, or just one -
  // so a locked Predict/Observe/Explain screen opens back up. The student's
  // own device picks this up next time it reconciles with the server
  // (see the fetchMyRecords effect above), unlocking the screen there too.
  async function handleResetProgress(studentId: string, moduleId?: string) {
    const confirmed = window.confirm(
      moduleId ? "Reset this student's progress for this experiment? They'll be able to redo it." : "Reset ALL of this student's progress? They'll be able to redo every module.",
    );
    if (!confirmed) return;

    try {
      await resetStudentProgress(studentId, moduleId);
      setSectionRecords((current) => current.filter((record) => !(record.userId === studentId && (!moduleId || record.moduleId === moduleId))));
      setSectionFeedback((current) => current.filter((entry) => !(entry.studentId === studentId && (!moduleId || entry.moduleId === moduleId))));
      showToast("Progress reset.");
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Could not reset progress.");
    }
  }

  // Sends a student to wherever their progress on this module actually is,
  // so tapping a graded row on Home lands them on a screen that shows the
  // "Teacher Feedback" card (the locked Predict screen or Result) instead of
  // a fresh, unlocked Predict form.
  function openModuleProgress(module: LearningModule, stages: Set<Stage>) {
    setActiveModule(module);
    if (stages.has("Explain")) goTo("result");
    else if (stages.has("Observe")) goTo("explain");
    else goTo("detail");
  }

  function openGrading(student: AuthUser, moduleId: string) {
    const existing = sectionFeedback.find((entry) => entry.studentId === student.id && entry.moduleId === moduleId);
    setGradingStudent(student);
    setGradingModuleId(moduleId);
    setFeedbackScore(existing?.score != null ? String(existing.score) : "");
    setFeedbackComment(existing?.comment || "");
    setFeedbackFormError("");
    goTo("grade");
  }

  async function handleSubmitFeedback(event: FormEvent) {
    event.preventDefault();
    setFeedbackFormError("");
    if (!activeSectionId || !gradingStudent || !gradingModuleId) return;
    if (!feedbackComment.trim()) {
      setFeedbackFormError("Write a comment for the student.");
      return;
    }
    const score = feedbackScore.trim() ? Number(feedbackScore) : null;
    if (score !== null && (Number.isNaN(score) || score < 0 || score > 100)) {
      setFeedbackFormError("Score must be a number from 0 to 100 (or left blank).");
      return;
    }

    try {
      const result = await submitFeedback(activeSectionId, gradingStudent.id, gradingModuleId, score, feedbackComment.trim());
      setSectionFeedback((current) => [...current.filter((entry) => !(entry.studentId === gradingStudent.id && entry.moduleId === gradingModuleId)), { ...result.feedback, studentId: gradingStudent.id }]);
      showToast("Feedback saved.");
      goBack();
    } catch (error) {
      setFeedbackFormError(error instanceof ApiError ? error.message : "Could not save feedback.");
    }
  }

  async function handleCreateSectionStudent(event: FormEvent) {
    event.preventDefault();
    setStudentFormError("");
    if (!activeSectionId) return;
    if (!studentUsername.trim() || !studentPassword || !studentName.trim()) {
      setStudentFormError("Username, password, and name are required.");
      return;
    }
    try {
      const result = await createSectionStudent(activeSectionId, studentUsername.trim(), studentPassword, studentName.trim());
      setSectionStudents((current) => [result.user, ...current]);
      setSections((current) => current.map((section) => (section.id === activeSectionId ? { ...section, studentCount: section.studentCount + 1 } : section)));
      setStudentUsername("");
      setStudentPassword("");
      setStudentName("");
      setShowAddStudent(false);
      showToast(`Student account "${result.user.username}" created.`);
    } catch (error) {
      setStudentFormError(error instanceof ApiError ? error.message : "Could not create student account.");
    }
  }

  function logout() {
    clearSession();
    setScreen("home");
    setHistory([]);
  }

  async function addRecord(stage: Stage, text: string) {
    const session = recordSession.current;
    const saveKey = `${activeModule.id}:${stage}`;
    if (!user || !session || pendingSaves.current.has(saveKey)) return null;
    pendingSaves.current.add(saveKey);
    const record: ActivityRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: user.id,
      role: role || "student",
      module: activeModule.title,
      moduleId: activeModule.id,
      mode: viewMode,
      stage,
      text,
      createdAt: new Date().toISOString(),
    };

    try {
      return await session.save(record);
    } catch {
      showToast("Could not save your work. Check browser storage and try again.");
      return null;
    } finally {
      pendingSaves.current.delete(saveKey);
    }
  }

  async function syncUnsyncedRecords(currentRecords: ActivityRecord[]) {
    if (!navigator.onLine || !user) return currentRecords;
    try {
      return await recordSession.current?.sync() || currentRecords;
    } catch {
      return currentRecords;
    }
  }

  async function prepareOffline() {
    setOfflineStatus("Downloading and verifying offline files...");
    try {
      await prepareOfflineFiles();
      const estimate = await navigator.storage?.estimate?.();
      const quotaMb = estimate?.quota ? `${Math.round(estimate.quota / 1024 / 1024)} MB storage quota` : "storage ready";
      setOfflineStatus(`Ready: ${modules.length} experiments cached; ${quotaMb}.`);
      showToast("Offline files prepared. Reopen once in airplane mode to verify.");
    } catch {
      setOfflineStatus("Offline preparation failed. Check connection and browser storage.");
      showToast("Offline preparation failed.");
    }
  }

  async function checkDevice() {
    const secure = location.protocol === "https:" || location.hostname === "localhost";
    const hasCameraApi = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const camera = hasCameraApi ? (secure ? "camera permission available" : "HTTPS needed for camera") : "camera API unavailable";
    const webgl = document.createElement("canvas").getContext("webgl") ? "WebGL ready" : "WebGL unavailable";
    const serviceWorker = "serviceWorker" in navigator ? "service worker ready" : "service worker unavailable";
    const estimate = await navigator.storage?.estimate?.();
    const storage = estimate?.quota ? `${Math.round(estimate.quota / 1024 / 1024)} MB storage quota` : "storage ready";
    const result = `${camera}; ${webgl}; ${serviceWorker}; ${storage}`;
    setDeviceStatus(result);
    showToast(result);
  }

  async function handleSync() {
    const before = records.filter((record) => !record.syncedAt).length;
    if (!before) {
      showToast("Nothing to sync - everything is already saved to your account.");
      return;
    }
    const next = await syncUnsyncedRecords(records);
    const after = next.filter((record) => !record.syncedAt).length;
    if (after === 0) showToast(`${before} record${before === 1 ? "" : "s"} synced.`);
    else if (after < before) showToast(`${before - after} of ${before} records synced. The rest will retry automatically.`);
    else showToast("Sync failed. Records are still saved offline and will retry automatically.");
  }

  function getExperimentTrial() {
    return {
      id: experimentTrials.length + 1,
      values: observationModel.readouts.map((readout) => readout.value),
    };
  }

  const titles: Record<Screen, [string, string]> = {
    home: ["Workspace", "Tuklas AR Science Lab"],
    modules: ["Modules", "Grade 9 MATATAG Science"],
    detail: ["Predict", activeModule.title],
    observe: [viewMode === "ar" ? "Camera Observation" : "3D Observation", activeModule.title],
    explain: ["Explain", activeModule.title],
    result: ["Results", "Activity Summary"],
    settings: ["Setup", isTeacherPreview ? "Device Setup" : "Device and Saved Work"],
    classes: ["Classes", "Sections You Handle"],
    section: ["Section", activeSection?.name || "Section"],
    grade: ["Grading", gradingStudent?.name || "Student"],
  };

  if (!user) {
    return (
      <main className="landing-screen" aria-labelledby="landingTitle">
        <section className="landing-hero">
          <p className="eyebrow">Grade 9 WebAR Science Learning</p>
          <h1 id="landingTitle">Tuklas AR Science Lab</h1>
          <p>Predict, observe, and explain science concepts using camera-based classroom activities and offline-ready learning records.</p>
        </section>
        <section className="auth-card panel-card">
          <div className="auth-tabs">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Log In</button>
            <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Teacher Sign Up</button>
          </div>

          {authMode === "login" && (
            <form className="auth-form" onSubmit={handleLogin}>
              <label className="field-label">Username<input type="text" autoComplete="username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} required /></label>
              <label className="field-label">Password<input type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required /></label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="primary-button" type="submit" disabled={authLoading}>{authLoading ? "Logging in..." : "Log In"}</button>
              <p className="auth-hint">Students: ask your teacher for a username and password.</p>
            </form>
          )}

          {authMode === "signup" && (
            <form className="auth-form" onSubmit={handleTeacherSignup}>
              <label className="field-label">Full name<input type="text" autoComplete="name" value={signupName} onChange={(event) => setSignupName(event.target.value)} required /></label>
              <label className="field-label">Username<input type="text" autoComplete="username" value={signupUsername} onChange={(event) => setSignupUsername(event.target.value)} required minLength={3} /></label>
              <label className="field-label">Password<input type="password" autoComplete="new-password" value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} required minLength={8} /></label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="primary-button" type="submit" disabled={authLoading}>{authLoading ? "Creating account..." : "Create Teacher Account"}</button>
              <p className="auth-hint">Teacher accounts can create student logins after signing in.</p>
            </form>
          )}
        </section>
        <section className="landing-flow" aria-label="Learning flow">
          {["Predict", "Observe", "Explain"].map((step) => <article key={step}><strong>{step}</strong></article>)}
        </section>
        <section className="landing-marker">
          <div>
            <p className="eyebrow">Reusable Group Marker</p>
            <h2>One printed marker per group</h2>
            <p>Students use the same marker across lessons during camera observation.</p>
          </div>
          <a className="marker-preview" href="/assets/tuklas-marker.png" target="_blank" rel="noreferrer" aria-label="Open printable Tuklas AR marker"><span>TUKLAS</span></a>
        </section>
      </main>
    );
  }

  const progressSection = (heading: string, items: typeof moduleProgress, empty: string) => (
    <section className="progress-category" aria-labelledby={`progress-${heading.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="row-between progress-category-heading"><h3 id={`progress-${heading.toLowerCase().replace(/\s+/g, "-")}`}>{heading}</h3><span>{items.length}</span></div>
      {items.length ? <div className="module-progress-list">
        {items.map(({ module, completed, percent: modulePercent, stages, grade }) => (
          <button type="button" className="module-progress-row" key={module.id} onClick={() => openModuleProgress(module, stages)}>
            <ModuleIcon moduleId={module.id} />
            <div>
              <div className="row-between"><strong>{module.quarter}: {module.title}</strong><span>{modulePercent}%</span></div>
              <div className="progress-track"><span style={{ width: `${modulePercent}%` }} /></div>
              <div className="row-between"><small>{completed} of {REQUIRED_STAGES.length} stages</small>{grade && <small className="graded-badge">Graded{grade.score != null ? ` · ${grade.score}/100` : ""}</small>}</div>
            </div>
          </button>
        ))}
      </div> : <p className="muted progress-empty">{empty}</p>}
    </section>
  );

  return (
    <div className={`${role}-mode`}>
      <header className="app-header">
        <button className={`back-button ${(history.length > 0 || selectedQuarter !== null) && screen !== "home" ? "visible" : ""}`} onClick={goBack} aria-label="Go back">&lt;</button>
        <div>
          <p className="eyebrow">{titles[screen][0]}</p>
          <h1>{titles[screen][1]}</h1>
        </div>
        <div className="header-actions">
          <button className="status-button">{online ? "Online" : "Offline"}</button>
          <button className="logout-button" onClick={logout}>Logout</button>
        </div>
        <AccountDetails user={user} />
      </header>

      <main className="screen-stack">
        {screen === "home" && (
          <section className="screen active">
            {isTeacherPreview ? (
              <>
                <article className="panel-card overall-progress">
                  <div className="row-between">
                    <div><p className="eyebrow">My Class</p><h2>Class Progress</h2></div>
                    <strong className="overall-percent">{students.length}</strong>
                  </div>
                  <p>{students.length} student account{students.length === 1 ? "" : "s"} - {classRecords.length} submission{classRecords.length === 1 ? "" : "s"} synced</p>
                  <div className="home-actions">
                    <button className="secondary-button compact-button" onClick={() => goTo("classes")}>Manage Classes</button>
                    <button className="text-button compact-button" onClick={() => goTo("modules")}>Preview Lessons</button>
                  </div>
                </article>
                <article className="panel-card class-roster">
                  <p className="eyebrow">Student Progress</p>
                  <div className="module-progress-list">
                    {classSummary.length ? classSummary.map(({ student, recordCount, percent: studentPercent }) => (
                      <div className="module-progress-row" key={student.id}>
                        <span className="student-avatar" aria-hidden="true">{student.name.trim().slice(0, 2).toUpperCase() || "ST"}</span>
                        <div>
                          <div className="row-between"><strong>{student.name}</strong><span>{studentPercent}%</span></div>
                          <div className="progress-track"><span style={{ width: `${studentPercent}%` }} /></div>
                          <small>{recordCount} submission{recordCount === 1 ? "" : "s"} synced</small>
                        </div>
                      </div>
                    )) : <p className="muted">No students yet. Add one from the Classes tab.</p>}
                  </div>
                </article>
              </>
            ) : (
              <article className="panel-card overall-progress">
                <div className="row-between">
                  <div><p className="eyebrow">All Experiments</p><h2>Progress Summary</h2></div>
                  <strong className="overall-percent">{overallPercent}%</strong>
                </div>
                <div className="progress-track overall-track"><span style={{ width: `${overallPercent}%` }} /></div>
                <p>{overallCompleted} of {overallTotal} activity stages completed</p>
                <div className="progress-categories">
                  {progressSection("Completed", completedModules, "No experiments completed yet.")}
                  {progressSection("Started", startedModules, "No experiments started yet.")}
                  {progressSection("Not Started", notStartedModules, "All experiments have been started.")}
                </div>
                {/* old progress list removed */}
                {false && <div>
                  {moduleProgress.map(({ module, completed, percent: modulePercent, stages, grade }) => (
                    <button type="button" className="module-progress-row" key={module.id} onClick={() => openModuleProgress(module, stages)}>
                      <ModuleIcon moduleId={module.id} />
                      <div>
                        <div className="row-between"><strong>{module.quarter}: {module.title}</strong><span>{modulePercent}%</span></div>
                        <div className="progress-track"><span style={{ width: `${modulePercent}%` }} /></div>
                        <div className="row-between">
                          <small>{completed} of {REQUIRED_STAGES.length} stages</small>
                          {grade && <small className="graded-badge">Graded{grade.score != null ? ` · ${grade.score}/100` : ""}</small>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>}
              </article>
            )}
            <article className="panel-card marker-access">
              <div className="marker-access-copy">
                <div><p className="eyebrow">AR Marker</p><h2>Printable and downloadable marker</h2><p>Open the marker for printing or download a copy for offline classroom use.</p></div>
                <a className="marker-preview" href="/assets/tuklas-marker.png" target="_blank" rel="noreferrer" aria-label="Open printable Tuklas AR marker"><span>TUKLAS</span></a>
              </div>
              <div className="marker-actions">
                <a className="primary-button" href="/assets/tuklas-marker.png" target="_blank" rel="noreferrer"><Printer size={18} />Open to Print</a>
                <a className="secondary-button" href="/assets/tuklas-marker.png" download="tuklas-ar-marker.png"><Download size={18} />Download Marker</a>
              </div>
            </article>
          </section>
        )}

        {screen === "modules" && (
          <section className="screen active">
            <nav className="curriculum-breadcrumb" aria-label="Curriculum navigation">
              <button onClick={() => { setSelectedQuarter(null); setSelectedGroup(null); }}>Quarters</button>
              {selectedQuarter !== null && <><span> / </span><button onClick={() => setSelectedGroup(null)}>Quarter {selectedQuarter}</button></>}
              {selectedGroup && <><span> / </span><span>{modules.find(m => m.groupId === selectedGroup)?.moduleTitle}</span></>}
            </nav>
            <label className="search-box"><span>Search experiments</span><input type="search" placeholder="Search topics or experiments..." value={query} onChange={event => setQuery(event.target.value)} /></label>
            <h2>{selectedGroup ? "Experiments" : selectedQuarter ? "Modules" : "Quarters"}</h2>
            <div className="module-list">
              {!selectedQuarter && [1, 2, 3, 4].map(quarter => {
                const items = visibleModules.filter(item => item.quarterNumber === quarter);
                if (!items.length) return null;
                return <button className="module-card" key={quarter} onClick={() => setSelectedQuarter(quarter)}><span className="module-icon">Q{quarter}</span><span><strong>{items[0].quarter}</strong><small>{new Set(items.map(i => i.groupId)).size} module(s), {items.length} experiments</small></span><span aria-hidden="true">&gt;</span></button>;
              })}
              {selectedQuarter && !selectedGroup && [...new Set(visibleModules.filter(item => item.quarterNumber === selectedQuarter).map(item => item.groupId))].map(group => {
                const items = visibleModules.filter(item => item.groupId === group);
                return <button className="module-card" key={group} onClick={() => setSelectedGroup(group)}><ModuleIcon moduleId={group} /><span><strong>{items[0].moduleNumber}. {items[0].moduleTitle}</strong><small>{items.length} POE experiments</small></span><span aria-hidden="true">&gt;</span></button>;
              })}
              {selectedGroup && visibleModules.filter(item => item.groupId === selectedGroup).map(item => <button className="module-card" key={item.id} onClick={() => { setActiveModule(item); goTo("detail"); }}><ModuleIcon moduleId={item.id} /><span><strong>{item.title}</strong><small>{item.subtitle}</small><small>{stagesFor(records, item.id).size ? `${REQUIRED_STAGES.filter(stage => stagesFor(records, item.id).has(stage)).length}/3 POE stages complete` : "Ready to explore"}</small></span><span aria-hidden="true">&gt;</span></button>)}
              {!visibleModules.some(item => (!selectedQuarter || item.quarterNumber === selectedQuarter) && (!selectedGroup || item.groupId === selectedGroup)) && <p>No matching experiments. Try another search.</p>}
            </div>
          </section>
        )}

        {screen === "detail" && (
          <section className="screen active">
            {isTeacherPreview && <p className="teacher-preview-note">Teacher Preview - explore this lesson before assigning it. Nothing here is saved as student work.</p>}
            <article className="panel-card">
              <div className="module-summary">
                <ModuleIcon moduleId={activeModule.id} />
                <div><h2>{activeModule.title}</h2><p>{activeModule.quarter} / {activeModule.moduleTitle}</p><small>Estimated time: {activeModule.time}</small></div>
              </div>
            </article>
            <article className="panel-card"><p className="eyebrow">Learning Task</p><p>{activeModule.task}</p></article>
            <article className="panel-card">
              <p className="eyebrow">POE Steps</p>
              <div className="poe-steps">{["Predict", "Observe", "Explain"].map((label, index) => <span className={index === 0 ? "active" : ""} key={label}>{index + 1}<small>{label}</small></span>)}</div>
            </article>
            {predictLocked ? (
              <>
                <article className="panel-card locked-notice">
                  <p className="eyebrow">Prediction Submitted</p>
                  <p>You already submitted your prediction for this experiment. Ask your teacher to reset it if you need to try again.</p>
                  <textarea className="readonly-field" rows={6} value={predictionReview} readOnly aria-readonly="true" aria-label="Your submitted prediction" />
                  <button className="primary-button" onClick={() => { setTrialPulse(0); goTo("observe"); }}>Continue to Observe</button>
                </article>
                {activeModuleFeedback && (
                  <article className="panel-card feedback-card">
                    <div className="row-between"><p className="eyebrow">Teacher Feedback</p>{activeModuleFeedback.score != null && <strong className="overall-percent">{activeModuleFeedback.score}/100</strong>}</div>
                    <p>{activeModuleFeedback.comment}</p>
                  </article>
                )}
              </>
            ) : (
              <article className="panel-card">
                <p className="eyebrow">Prediction Questions</p>
                <div className="prediction-questions">
                  {activeModule.predictions.map((prediction, questionIndex) => (
                    <fieldset className="prediction-question" key={prediction.question}>
                      <legend><span>{questionIndex + 1}</span>{prediction.question}</legend>
                      <div className="choice-list">
                        {prediction.choices.map((choice) => (
                          <label key={choice}><input type="radio" name={`prediction-${questionIndex}`} value={choice} checked={selectedPredictions[questionIndex] === choice} onChange={(event) => setSelectedPredictions((current) => { const next = [...current]; next[questionIndex] = event.target.value; return next; })} /><span>{choice}</span></label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <textarea rows={3} placeholder="Why do you think so? (optional)" value={predictionNote} onChange={(event) => setPredictionNote(event.target.value)} />
                <button className="primary-button" onClick={async () => {
                  if (activeModule.predictions.some((_, index) => !selectedPredictions[index])) return showToast("Answer all prediction questions.");
                  const answers = activeModule.predictions.map((prediction, index) => `${index + 1}. ${prediction.question}\nAnswer: ${selectedPredictions[index]}`).join("\n\n");
                  const text = `${answers}${predictionNote.trim() ? `\n\nReasoning: ${predictionNote.trim()}` : ""}`;
                  if (!isTeacherPreview) {
                    const next = await addRecord("Predict", text);
                    if (!next) return;
                    await syncUnsyncedRecords(next);
                  }
                  setTrialPulse(0);
                  goTo("observe");
                }}>Next</button>
              </article>
            )}
          </section>
        )}

        {screen === "observe" && (
          <section className="screen active">
            {isTeacherPreview && <p className="teacher-preview-note">Teacher Preview - trials run normally but aren't saved as student work.</p>}
            <article className="ar-panel">
              <div className="row-between">
                <div><p className="eyebrow">{viewMode === "ar" ? "Camera Mode" : "3D Model Mode"}</p><h2>{viewMode === "ar" ? "Start the camera and observe the trial" : "Use the model when camera access is unavailable"}</h2></div>
                <button className="text-button compact-button" onClick={() => setViewMode(viewMode === "ar" ? "fallback" : "ar")}>{viewMode === "ar" ? "Use 3D Model" : "Use Camera"}</button>
              </div>
              <div className={`ar-frame ${viewMode === "fallback" ? "fallback-mode" : ""}`}>
                <Suspense fallback={null}>
                  <ScienceScene moduleId={activeModule.id} controlA={controlA} controlB={controlB} lab={lab} trialPulse={trialPulse} viewMode={viewMode} onArReady={setCameraReady} onArStatus={setCameraStatus} onMarkerChange={setMarkerDetected} onControlChange={(which, value) => (which === "a" ? setControlA(value) : setControlB(value))} />
                </Suspense>
              </div>
              {viewMode === "ar" && (
                <>
                  <p className="camera-status">{cameraStatus}</p>
                </>
              )}
            </article>
            <article className="panel-card">
              <p className="eyebrow">Observation Prompt</p>
              <p>{activeModule.observe}</p>
              <div className="control-grid">
                <label><span>{observationModel.controlA.label} <strong>{formatControlValue(activeModule.id, "a", controlA, observationModel.controlA.unit)}</strong></span><input type="range" min={observationModel.controlA.min} max={observationModel.controlA.max} step={observationModel.controlA.step} value={controlA} onChange={(event) => { setControlA(Number(event.target.value)); if (activeModule.id === "bonding") setLab(current => ({ ...current, electrons: 0 })); }} /></label>
                <label><span>{observationModel.controlB.label} <strong>{formatControlValue(activeModule.id, "b", controlB, observationModel.controlB.unit)}</strong></span><input type="range" min={observationModel.controlB.min} max={observationModel.controlB.max} step={observationModel.controlB.step} value={controlB} onChange={(event) => setControlB(Number(event.target.value))} /></label>
              </div>
              <ExperimentControls key={`${activeModule.id}-${controlA}`} id={activeModule.id} a={controlA} lab={lab} onChange={setLab} />
              <button className="text-button" onClick={() => { const defaults = getObservationDefaults(activeModule.id); setControlA(defaults.controlA); setControlB(defaults.controlB); setLab(initialLabState()); setTrialPulse(p => p + 1); }}>Reset model</button>
              <div className="data-readout">
                {observationModel.readouts.map((readout) => <span key={readout.label}>{readout.label} <strong>{readout.value}</strong></span>)}
              </div>
              <div className="motion-trials" aria-label="Experiment trial results">
                <div className="motion-trial-header" style={{ gridTemplateColumns: `48px repeat(${observationModel.readouts.length}, minmax(110px, 1fr))` }}>
                  <span>Trial</span>{observationModel.readouts.map((readout) => <span key={readout.label}>{readout.label}</span>)}
                </div>
                {experimentTrials.length ? experimentTrials.map((trial) => (
                  <div className="motion-trial-row" style={{ gridTemplateColumns: `48px repeat(${observationModel.readouts.length}, minmax(110px, 1fr))` }} key={trial.id}>
                    <span>{trial.id}</span>{trial.values.map((value, index) => <span key={`${trial.id}-${observationModel.readouts[index]?.label}`}>{value}</span>)}
                  </div>
                )) : <p className="muted">No trials yet. Change a variable, then run a trial.</p>}
              </div>
              {observeLocked && <p className="teacher-preview-note">Observation saved. You can continue comparing trials; ask your teacher to reset the submission to replace it.</p>}
              <button className="primary-button" disabled={(viewMode === "ar" && (!cameraReady || !markerDetected))} onClick={async () => {
                if (viewMode === "ar" && (!cameraReady || !markerDetected)) return showToast("Detect the Tuklas marker before saving an AR trial.");
                setTrialPulse((current) => current + 1);
                setExperimentTrials((current) => [...current, getExperimentTrial()]);
                if (!isTeacherPreview && !observeLocked) {
                  const next = await addRecord("Observe", `Mode: ${viewMode}; ${observationModel.recordText}`);
                  if (!next) return;
                  await syncUnsyncedRecords(next);
                }
              }}>Run Trial</button>
              <button className="secondary-button" onClick={() => (isTeacherPreview || activeModuleStages.has("Observe")) ? goTo("explain") : showToast("Run at least one AR or 3D trial first.")}>Continue</button>
            </article>
          </section>
        )}

        {screen === "explain" && (
          <section className="screen active">
            {isTeacherPreview && <p className="teacher-preview-note">Teacher Preview - your write-up here isn't saved as student work.</p>}
            {explainLocked ? (
              <article className="panel-card locked-notice">
                <p className="eyebrow">Explanation Submitted</p>
                <p>You already submitted your explanation for this experiment. Ask your teacher to reset it if you need to try again.</p>
                <textarea className="readonly-field" rows={6} value={existingExplainText} readOnly aria-readonly="true" aria-label="Your submitted explanation" />
                <button className="primary-button" onClick={() => goTo("result")}>View Results</button>
              </article>
            ) : (
              <article className="panel-card">
                <p>Use your observations to explain the results.</p>
                <label className="field-label">My predictions<textarea className="readonly-field" rows={10} value={predictionReview} readOnly aria-readonly="true" /></label>
                <label className="field-label">Evidence from observation<textarea rows={5} placeholder="What did you observe? Include data or patterns." value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
                <label className="field-label">Scientific explanation<textarea rows={5} placeholder="Explain why this happened using scientific ideas." value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label>
                <button className="primary-button" onClick={async () => {
                  if (!evidence.trim() || !explanation.trim()) return showToast("Add evidence and a scientific explanation.");
                  if (!isTeacherPreview) {
                    const next = await addRecord("Explain", `Evidence: ${evidence.trim()} / Explanation: ${explanation.trim()}`);
                    if (!next) return;
                    await syncUnsyncedRecords(next);
                  }
                  goTo("result");
                }}>Submit</button>
              </article>
            )}
          </section>
        )}

        {screen === "result" && (
          <section className="screen active">
            {isTeacherPreview ? (
              <article className="result-card"><div className="score-ring"><strong>OK</strong><span>Preview</span></div><h2>Preview complete</h2><p>Prediction, Observation, and Explanation steps previewed.</p></article>
            ) : (
              <article className="result-card"><div className="score-ring"><strong>{Math.max(25, percent)}%</strong><span>Complete</span></div><h2>Great work!</h2><p>Prediction, Observation, and Explanation completed.</p></article>
            )}
            <article className="panel-card look-back"><p className="eyebrow">Look Back</p><h2>{activeModule.title}</h2><p>{activeModule.overview}</p></article>
            {activeModuleFeedback && (
              <article className="panel-card feedback-card">
                <div className="row-between"><p className="eyebrow">Teacher Feedback</p>{activeModuleFeedback.score != null && <strong className="overall-percent">{activeModuleFeedback.score}/100</strong>}</div>
                <p>{activeModuleFeedback.comment}</p>
              </article>
            )}
            <article className="panel-card">
              <p className="eyebrow">Reflection Prompt</p>
              <p>What did you learn from this activity? How can this be applied in real life?</p>
              <textarea rows={4} placeholder="Write your reflection..." value={reflection} onChange={(event) => setReflection(event.target.value)} />
              <button className="secondary-button" onClick={async () => {
                if (!reflection.trim()) return showToast("Write a reflection before saving.");
                if (!isTeacherPreview) {
                  const next = await addRecord("Reflection", reflection.trim());
                  if (!next) return;
                  await syncUnsyncedRecords(next);
                }
                setReflection("");
                showToast(isTeacherPreview ? "Reflection previewed (not saved)." : "Reflection saved.");
              }}>Save Reflection</button>
            </article>
          </section>
        )}

        {screen === "settings" && (
          <section className="screen active">
            {!installed && installPrompt && (
              <button className="settings-row" onClick={installApp}><span><strong>Install App</strong><small>Add Tuklas to your home screen, like a regular app.</small></span><span aria-hidden="true">&gt;</span></button>
            )}
            {installed && (
              <article className="panel-card"><p className="eyebrow">Installed</p><p>Tuklas is installed on this device.</p></article>
            )}
            <button className="settings-row" onClick={prepareOffline}><span><strong>Prepare for Offline Use</strong><small>{offlineStatus}</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={handleSync}><span><strong>Sync Saved Work</strong><small>{records.filter((record) => !record.syncedAt).length} records waiting to sync.</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={checkDevice}><span><strong>Device Check</strong><small>{deviceStatus}</small></span><span aria-hidden="true">&gt;</span></button>
            <article className="panel-card offline-checklist"><p className="eyebrow">Offline Setup</p><ol><li>Open this HTTPS app while connected.</li><li>Tap Prepare for Offline Use.</li><li>Add the app to the home screen.</li><li>Reopen in airplane mode and run one trial.</li></ol></article>
            {!isTeacherPreview && (
              <article className="panel-card teacher-tools">
                <div className="row-between"><h2>Saved Work</h2><button className="text-button compact-button" onClick={async () => {
                  if (!user) return;
                  const unsyncedCount = records.filter((record) => !record.syncedAt).length;
                  const message = unsyncedCount
                    ? `This permanently deletes ${unsyncedCount} unsynced record${unsyncedCount === 1 ? "" : "s"} that never reached the server - that work cannot be recovered. Already-submitted (synced) work will simply reappear next sync, since only a teacher's Reset Progress can actually undo it. Continue?`
                    : "This clears this device's local cache. Already-submitted (synced) work will reappear on next sync - only a teacher's Reset Progress can actually undo it. Continue?";
                  if (!window.confirm(message)) return;
                  await recordSession.current?.clear();
                  showToast("Local cache cleared.");
                }}>Clear Cache</button></div>
                <p className="muted">Clears this device's cache only. Already-submitted work stays locked until your teacher resets it.</p>
                <div className="records-list">
                  {records.length ? records.slice().reverse().map((record) => <article className="record-card" key={record.id}><small>{record.role} / {record.module} / {record.stage} / {new Date(record.createdAt).toLocaleString()} {record.syncedAt ? "/ synced" : "/ offline"}</small><p>{record.text}</p></article>) : <p className="muted">No saved progress on this device yet.</p>}
                </div>
                <button className="secondary-button" onClick={() => {
                  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "tuklas-saved-progress.json";
                  link.click();
                  URL.revokeObjectURL(url);
                }}>Export JSON</button>
              </article>
            )}
          </section>
        )}

        {screen === "classes" && (
          <section className="screen active">
            <article className="panel-card">
              <p className="eyebrow">New Section</p>
              <form className="auth-form compact-form" onSubmit={handleCreateSection}>
                <label className="field-label">Section name<input type="text" placeholder="e.g. Grade 9 - Rizal" value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} required /></label>
                {sectionFormError && <p className="auth-error" role="alert">{sectionFormError}</p>}
                <button className="secondary-button" type="submit">Create Section</button>
              </form>
            </article>
            <div className="module-list">
              {sections.length ? sections.map((section) => (
                <button className="module-card" key={section.id} onClick={() => openSection(section.id)}>
                  <span className="student-avatar" aria-hidden="true">{section.name.trim().slice(0, 2).toUpperCase() || "SC"}</span>
                  <span><strong>{section.name}</strong><small>{section.studentCount} student{section.studentCount === 1 ? "" : "s"}</small></span>
                  <small aria-hidden="true" />
                  <span aria-hidden="true">&gt;</span>
                </button>
              )) : <p className="muted">No sections yet. Create one above.</p>}
            </div>
          </section>
        )}

        {screen === "section" && (
          <section className="screen active">
            <article className="panel-card">
              <p className="eyebrow">Section</p>
              <h2>{activeSection?.name || "Loading..."}</h2>
              <p>{sectionStudents.length} student{sectionStudents.length === 1 ? "" : "s"} enrolled</p>
            </article>
            <article className="panel-card">
              <button type="button" className="row-between disclosure-toggle" onClick={() => setShowAddStudent((current) => !current)} aria-expanded={showAddStudent}>
                <span className="eyebrow">Add Student</span>
                <span className={`disclosure-chevron ${showAddStudent ? "open" : ""}`} aria-hidden="true">&gt;</span>
              </button>
              {showAddStudent && (
                <form className="auth-form compact-form" onSubmit={handleCreateSectionStudent}>
                  <label className="field-label">Full name<input type="text" value={studentName} onChange={(event) => setStudentName(event.target.value)} required /></label>
                  <label className="field-label">Username<input type="text" value={studentUsername} onChange={(event) => setStudentUsername(event.target.value)} required minLength={3} /></label>
                  <label className="field-label">Password<input type="password" value={studentPassword} onChange={(event) => setStudentPassword(event.target.value)} required minLength={8} /></label>
                  {studentFormError && <p className="auth-error" role="alert">{studentFormError}</p>}
                  <button className="secondary-button" type="submit">Add Student</button>
                </form>
              )}
            </article>
            <article className="panel-card">
              <p className="eyebrow">Enrolled Students</p>
              <div className="records-list">
                {sectionStudents.length ? sectionStudents.map((student) => {
                  const studentRecords = sectionRecords.filter((record) => record.userId === student.id);
                  const isExpanded = expandedStudentId === student.id;
                  return (
                    <article className="record-card" key={student.id}>
                      <button
                        type="button"
                        className="row-between disclosure-toggle"
                        onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                        aria-expanded={isExpanded}
                      >
                        <span><small>{student.username}</small><p>{student.name}</p></span>
                        <span className={`disclosure-chevron ${isExpanded ? "open" : ""}`} aria-hidden="true">&gt;</span>
                      </button>
                      {isExpanded && (
                        <div className="student-progress-panel">
                          {modules.map((module) => {
                            const stages = new Set(studentRecords.filter((record) => record.moduleId === module.id).map((record) => record.stage));
                            const done = REQUIRED_STAGES.filter((stage) => stages.has(stage)).length;
                            const grade = sectionFeedback.find((entry) => entry.studentId === student.id && entry.moduleId === module.id);
                            return (
                              <div className="row-between student-module-row" key={module.id}>
                                {done > 0 ? (
                                  <button type="button" className="text-button module-grade-link" onClick={() => openGrading(student, module.id)}>
                                    {module.title} - {done}/{REQUIRED_STAGES.length} stages{grade ? ` - Graded${grade.score != null ? ` (${grade.score})` : ""}` : ""}
                                  </button>
                                ) : (
                                  <small>{module.title} - {done}/{REQUIRED_STAGES.length} stages</small>
                                )}
                                {done > 0 && <button type="button" className="text-button compact-button" onClick={() => handleResetProgress(student.id, module.id)}>Reset</button>}
                              </div>
                            );
                          })}
                          {studentRecords.length > 0 && (
                            <button type="button" className="secondary-button" onClick={() => handleResetProgress(student.id)}>Reset All Progress</button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                }) : <p className="muted">No students enrolled yet.</p>}
              </div>
            </article>
          </section>
        )}

        {screen === "grade" && gradingStudent && gradingModuleId && (() => {
          const gradingModule = modules.find((module) => module.id === gradingModuleId);
          const submissions = sectionRecords.filter((record) => record.userId === gradingStudent.id && record.moduleId === gradingModuleId);
          return (
            <section className="screen active">
              <article className="panel-card">
                <p className="eyebrow">Grading</p>
                <h2>{gradingStudent.name}</h2>
                <p>{gradingModule?.title || "Module"}</p>
              </article>
              <article className="panel-card">
                <p className="eyebrow">Submitted Work</p>
                <div className="records-list">
                  {submissions.length ? submissions.slice().reverse().map((record) => (
                    <article className="record-card" key={record.id}>
                      <small>{record.stage}</small>
                      <p>{record.text}</p>
                    </article>
                  )) : <p className="muted">No submission found for this experiment.</p>}
                </div>
              </article>
              <article className="panel-card">
                <p className="eyebrow">Grade &amp; Feedback</p>
                <form className="auth-form" onSubmit={handleSubmitFeedback}>
                  <label className="field-label">Score (0-100, optional)<input type="number" min={0} max={100} value={feedbackScore} onChange={(event) => setFeedbackScore(event.target.value)} /></label>
                  <label className="field-label">Comment for the student<textarea rows={5} placeholder="What did they do well? What should they improve?" value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} required /></label>
                  {feedbackFormError && <p className="auth-error" role="alert">{feedbackFormError}</p>}
                  <button className="primary-button" type="submit">Save Feedback</button>
                </form>
              </article>
            </section>
          );
        })()}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation" style={{ gridTemplateColumns: `repeat(${isTeacherPreview ? 4 : 3}, 1fr)` }}>
        {(isTeacherPreview ? (["home", "modules", "classes", "settings"] as Screen[]) : (["home", "modules", "settings"] as Screen[])).map((item) => {
          const previewFlowScreens: Screen[] = ["modules", "detail", "observe", "explain", "result"];
          const isActive =
            screen === item ||
            (item === "modules" && previewFlowScreens.includes(screen)) ||
            ((screen === "section" || screen === "grade") && item === "classes");
          return (
            <button key={item} className={isActive ? "active" : ""} onClick={() => goTo(item)}>
              {item === "modules" ? "Modules" : item === "classes" ? "Classes" : item[0].toUpperCase() + item.slice(1)}
            </button>
          );
        })}
      </nav>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

export default App;
