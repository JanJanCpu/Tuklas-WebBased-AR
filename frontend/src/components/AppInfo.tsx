import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

// Shown in Settings and in the fps HUD; bump on every build you want to confirm on a phone.
export const BUILD = "b55";
const UPDATED = "October 13, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="panel-card info-section">
      <summary className="row-between"><strong>{title}</strong><span className="disclosure-chevron" aria-hidden="true"><ChevronRight size={18} strokeWidth={2.4} /></span></summary>
      <div className="info-body">{children}</div>
    </details>
  );
}

const faqs: [string, string][] = [
  ["How do I get an account?", "Students do not sign up. Your teacher creates your account and gives you a login slip with your username and password. Teachers can create their own account on the login screen."],
  ["I forgot my password.", "Ask your teacher. They can give you a new password from their class list. The old password stops working right away."],
  ["Does it work without internet?", "Yes. Open the app once while online, go to Settings and tap Prepare for Offline Use. After that you can log in and do activities offline. Your work is saved on the device and sent to your teacher the next time you are online."],
  ["What is the marker for?", "The printed TUKLAS marker is where the experiment appears in camera mode. Point the camera at it and keep the whole marker in view. One printed marker can be shared by a group."],
  ["Do I need a camera or printed marker?", "No. Experiments open in 3D Model Mode without a camera or marker. To try AR, tap Use Camera and point it at the printed TUKLAS marker. Tap Use 3D Model to return."],
  ["Can I change my answer after I submit?", "No. Each Predict, Observe and Explain answer is locked once saved, so your prediction stays your own. If you need to redo a lesson, ask your teacher to reset your progress."],
  ["The app looks old or broken after an update.", "Close the app fully and open it again while online. If that does not help, clear the site data in your browser settings and log in again."],
  ["Why is the experiment slow on my phone?", "The app lowers the graphics quality on its own when a phone is slow. Close other apps and keep the marker steady and well lit."],
];

export default function AppInfo() {
  return (
    <div className="app-info">
      <Section title="About Tuklas">
        <p><strong>Tuklas AR Science Lab</strong> is a learning app for Grade 9 Science. Students do virtual experiments using augmented reality (AR) or 3D, following the Predict, Observe, Explain approach: first predict what will happen, then observe the experiment, then explain the result.</p>
        <p>It has 12 activities aligned to the DepEd MATATAG Grade 9 Science curriculum, covering motion, electricity, earth and space, life science, and materials. It works offline and on low-cost Android phones, for public school classrooms without a complete science laboratory.</p>
        <p className="muted">Version {BUILD}</p>
      </Section>
      <Section title="The Researchers">
        <p>Tuklas was developed as a capstone project at Pamantasan ng Lungsod ng Maynila (PLM), Bachelor of Science in Information Technology:</p>
        <p><em>Development of an Offline Augmented Reality Science Laboratory Simulator Using the Prediction-Observation-Explanation Approach for Resource-Limited Public Grade 9 Classrooms in Manila</em></p>
        <ul>
          <li>Earl Stephen E. Dulay, Researcher</li>
          <li>Jan Aldridge S. Pesa, Researcher</li>
          <li>Dr. Criselle J. Centeno, Adviser</li>
        </ul>
      </Section>
      <Section title="Frequently Asked Questions">
        {faqs.map(([q, a]) => <div key={q} className="info-faq"><strong>{q}</strong><p>{a}</p></div>)}
      </Section>
      <Section title="Privacy Policy">
        <p className="muted">Last updated {UPDATED}</p>
        <p>We follow the Data Privacy Act of 2012 (Republic Act No. 10173). We collect only what the app needs to work.</p>
        <p><strong>What we store.</strong> Your name, username and password (stored only in scrambled, hashed form, so no one can read it), your role (teacher or student), your section, the answers you submit in each activity, and your teacher's scores and comments.</p>
        <p><strong>What we do not collect.</strong> No phone number, email address, birthday, address or location. The camera is used only on your device to find the marker. No photo or video is recorded or sent anywhere. There are no ads and no tracking.</p>
        <p><strong>Who can see it.</strong> You, the teacher who created your account, and the researchers for the purposes of the study. Results used in the study are reported as group data without student names. Your information is never sold or shared with anyone else.</p>
        <p><strong>Where it is kept.</strong> On your device, so you can work offline, and in the app's online database. Shared classroom devices keep each user's work separate. If a teacher sends a login by SMS or email, it is sent from the teacher's own phone or email app; Tuklas does not store the number or address.</p>
        <p><strong>Your rights.</strong> You can ask to see, correct or delete your information. Ask your teacher, or contact the researchers through PLM. Students under 18 take part with the consent of a parent or guardian.</p>
      </Section>
      <Section title="Terms of Use">
        <p className="muted">Last updated {UPDATED}</p>
        <ul>
          <li>Tuklas is free to use for teaching and learning.</li>
          <li>Keep your password private and do not use another person's account.</li>
          <li>Submit your own answers. Your teacher can see everything you submit.</li>
          <li>The experiments are simulations to help you understand science ideas. They do not replace real laboratory safety rules. Be aware of your surroundings when using the camera.</li>
          <li>The app is provided as it is, as part of a research project. We try to keep it working and your work saved, but cannot promise it will always be available.</li>
        </ul>
      </Section>
    </div>
  );
}

const tips = {
  student: [
    ["Predict", "Before each experiment, write what you think will happen. There is no wrong prediction."],
    ["Observe", "The 3D model opens first. Drag and tap the parts to run trials. To try AR, tap Use Camera and point it at the printed TUKLAS marker."],
    ["Explain", "Compare what you saw with your prediction. Your answers go to your teacher, even if you were offline."],
  ],
  teacher: [
    ["Try a lesson", "Tap Preview Lessons and choose an experiment. The 3D model needs no camera or marker, and preview work is not saved as student work."],
    ["Make a class", "When ready to use Tuklas with students, go to Classes, create a section, then use Add Whole Class to paste your class list."],
    ["Give out logins", "Print the login slips, or send each one by SMS or email from your own phone."],
  ],
} as const;

// First-run tips on Home, hidden for good once dismissed on this device.
export function GettingStarted({ userId, role }: { userId: string; role: "student" | "teacher" }) {
  const key = `tuklas-tips-done:${userId}`;
  const [done, setDone] = useState(() => { try { return localStorage.getItem(key) === "1"; } catch { return false; } });
  if (done) return null;
  return (
    <article className="panel-card getting-started">
      <p className="eyebrow">Getting Started</p>
      <ol>
        {tips[role].map(([title, text]) => <li key={title}><strong>{title}</strong><p>{text}</p></li>)}
      </ol>
      <button type="button" className="secondary-button compact-button" onClick={() => { try { localStorage.setItem(key, "1"); } catch { /* still hide for this visit */ } setDone(true); }}>Got it</button>
    </article>
  );
}
