# Astronaut Acute Health Decision Tree — Version 3 (Full Text)

*English translation of the Spark Team's acute decision tree document (version 3, full text), 14 Nov 2026. The app's Emergency flow (`src/config/acuteTree.json`, `acuteInstructions.json`, `acuteWatch.json`) implements this document.*

> **Translation notes.** Outcome codes are given in English and match the app. Question codes (T1, M2, TR4a…) keep their original letters. The eye-branch questions G1/G1a/G1b/G2/G2a are called EY1/EY1a/EY1b/EY2/EY2a, as in the app, because they collide with the selection screens G1/G2. Environment codes: **μg** microgravity, **landing** landing day and the next 72 h, **surface** Moon or Mars surface, **suit** inside the spacesuit. Clinical content is a draft awaiting physician approval; thresholds and times marked "(proposal)" were chosen for this draft.

This document is the single, complete text of the decision tree; it replaces the version 2 PDF and the version 3 change notes. The tree links 22 acute conditions through 115 questions and selection screens to 64 instructions (15 EMERGENCY, 17 PRIORITY, 32 MONITOR). The panel works with the sensors, the medication stock, G-TRANSIT and the loss-of-signal (LOS) queue. The aim is not to make a diagnosis but to give the instruction that fits the situation.

## Changes since version 2

Version 3 fixes five errors, turns the entry of the tree into selection screens and connects the tree to the rest of the panel. Questions fell from 117 to 115; outcomes rose from 62 to 64.

| Topic | Version 2 | Version 3 |
| --- | --- | --- |
| Stage 0 | S1, S1b, S2, S3, S3a: five yes/no questions | Three selection screens: G1 Safety (choose a problem if there is one, otherwise skip), G2 Who for (choose the person), G3 Consciousness and breathing |
| Choosing the person | After "Is it for yourself?" the person was unknown | If opened for someone else, the person is chosen from the crew list; the panel loads that person's sensors and records |
| Environmental hazard | Headache in several people went to EMERGENCY A-ENVIRONMENT at S1b and to MONITOR C-CO2 at H1 | A-ENVIRONMENT only for an acute hazard; new C-ENVIRONMENT-CO2 (PRIORITY) for gradual CO₂. The sensor makes the choice. H1 removed; GN2a and C-HYPOXIA follow the same rule |
| Blood glucose | In no instruction | Measured with i-STAT in A-CONSCIOUSNESS, A-BRAIN, C-HEAD-SEVERE, C-FAINTING, A-HEAT |
| Heat stroke | No outcome | New A-HEAT (EMERGENCY) and a new S4 label (T10) |
| R1c | "Fever longer than 3 days?" was asked even without fever | Asked only if R1 is "Yes" |
| Questions the panel already knows | Were asked | G1, T4a, T6, X1, X2, GN2a, GN2b, H1a are pre-filled; the person confirms |
| S4 | "Yes" led through T1 to T9 in order | Each label goes straight to its own outcome |
| Answer options | Yes / No | "Not sure" on every question; it goes to the more dangerous branch |
| Steps | Same in every environment | Separate steps for microgravity, landing, planetary surface and spacesuit; G-TRANSIT on landing |
| Instruction | Plain text | Step list, timer, automatic measurement, sensor-triggered "If it gets worse" |
| MONITOR | "Reopen the panel" | The panel asks the follow-up questions itself |
| Medication | "Per kit procedure" | Stock and expiry shown, double check for critical drugs, simplified instruction when the patient is the CMO |
| When communication returns | To be compiled by hand | An SBAR package is built automatically and enters the LOS queue |

## How it works

The panel moves through five stages: first safety and the person, then life-threatening conditions, then the questions that rule out the most conditions, and last the distinguishing details. Without a red flag, an astronaut using the panel for themselves reached an instruction in 14 questions on average in version 2; the target for version 3 is 10 or fewer (to be measured on the decision tree JSON).

1. **Stage 0 · Safety and person:** three selection screens. Is there a hazard in the environment, who is the panel opened for, is the person conscious.
2. **Stage 1 · Rapid triage:** the S4 red flags on one screen; a selected label goes straight to an EMERGENCY instruction.
3. **Stage 1b · Context:** EVA and radiation warning in the last 24 hours. The panel fills them in, the person confirms; the answers are used as flags in later branches.
4. **Stage 2 · Main sorting:** each question separates one body region; "No" rules out the conditions of that region.
5. **Stage 3 · Branch questions:** the dangerous possibility is asked first, then the most common condition.

If a hazard is selected at G1, A-ENVIRONMENT is applied first and the flow then continues from G2. If the panel is opened for someone else, G3 asks about consciousness. A label selected at S4 goes straight to its outcome; "If it gets worse" moves to another outcome; a bad answer to a MONITOR follow-up reopens the tree from the start.

*Decision tree flow: 8 stages, 3 side screens, 3 loops.*

## Levels

| Level | Meaning | Outcomes | Communication package |
| --- | --- | --- | --- |
| EMERGENCY | Act immediately | 15 | First communication window, highest priority |
| PRIORITY | Act within hours, regular monitoring | 17 | First communication window |
| MONITOR | Self-care, records, follow-up questions from the panel | 32 | Next planned communication |

### The three parts of an instruction

No step waits for an answer from Earth. Every instruction has three parts; EMERGENCY and PRIORITY instructions add "Automatic monitoring" and "If it gets worse" lines, MONITOR instructions have "Then" and "Follow-up" lines.

| Part | When | Content |
| --- | --- | --- |
| Do now | First minutes | Ordered, life-saving steps |
| While waiting for communication | No link, 20 minutes or longer | Monitoring intervals, medication decisions, a second dose and other decisions the crew makes itself |
| When communication returns | When the link is up | Information that must go into the SBAR package |

Medication and dose decisions are left to the mission medical kit procedure and to the crew medical officer (CMO); the panel does not write doses. Only mission-level decisions such as evacuation or surgery are left to Earth.

### Question writing rules

- Each question asks one thing. Average length 7 words; the longest question has 13 words.
- Examples are not in the question but in the small hint line below it.
- If a question lists several signs, all lead to the same outcome; if even one is present the answer is "Yes".
- No medical terms; names such as "anaphylaxis" appear only in outcome titles.

Selection screens (G1, G2, G3, S4) are made of large buttons and fit on one page of the cabin display. On the 5-key EVA display they are split over two pages if needed; the "Not sure" button is on every page.

## Engine rules

These rules apply to all questions and instructions. The question tables below list only the exceptions.

### Pre-fill and confirm

Questions whose answer is known from the panel's data are not asked blank: the panel fills in the answer and the person presses Confirm, Correct or Not sure.

| Question | Panel source | Pre-selection rule |
| --- | --- | --- |
| G1 · Safety options | Cabin alarm telemetry, symptom diaries, crew SpO₂ | Smoke, pressure or gas alarm in the last hour; the same sign in at least 2 people in the last 6 hours; cabin O₂ or CO₂ red |
| G2 · Who for | The sensor that raised the alarm | The person who raised the alarm is highlighted |
| T4a · Heart rhythm | Background ECG, last 10 min | Pulse <40 or >150, pause >3 s, irregular rhythm |
| T6 · Fever | Core temperature | ≥38.5 °C at rest (Table A yellow) |
| X1 · EVA or pressure drop | EVA log, cabin and suit pressure | EVA in the last 24 h, cabin <14.0 psia or suit <3.8 psi |
| X2 · Radiation warning | RadLab dose rate, DONKI SEP, GOES protons | Dose rate yellow/red or an SEP event in the last 48 h |
| GN2a · Same sign in others | Symptom diaries | The same sign in someone else in the last 6 hours |
| GN2b · Cabin O₂ and pressure normal | Cabin sensors | Both green in Table A |
| H1a · High CO₂ | Cabin CO₂ sensor | 1-hour mean ≥2.5 mmHg |

If there is no sensor data or its quality is below 0.5, the question is asked normally.

**Conflict rule:** if the person's answer conflicts with a sensor, the panel takes the safe side and shows a yellow note (e.g. "You said 'regular', but the ECG shows a 4.1 s pause; A-RHYTHM is suggested"). The person can change it with Correct; both answers go into the package.

**Sensor-triggered opening:** the panel can open the tree itself on a red alarm (e.g. SpO₂ ≤91, core temperature ≥40.0 °C). The person concerned and the options come pre-selected; the screen shows why it opened.

### "Not sure"

Every question and selection screen has a third button. General rule: the answer goes to the more dangerous branch; if both branches are equally dangerous, the next question follows. Every "Not sure" is recorded as "?" and becomes an open question in the SBAR package. The direction for each question is given in the "Not sure →" column of the tables.

- In Stage 2 (M questions) "Not sure" enters the branch; if the branch ends in its general MONITOR outcome, the panel returns to the next M question, so the region is not ruled out.
- In branch questions, an answer between PRIORITY and MONITOR goes to PRIORITY.
- If 3 or more "Not sure" answers are given in one session, the panel suggests that a crewmate answers the questions and raises the package priority by one level.

### Environment codes

Steps involving position and fluids change with the environment. The panel knows the environment from the mission phase; a step without an environment code applies everywhere.

| Code | Environment | How the panel knows |
| --- | --- | --- |
| μg | Microgravity | Mission phase: transit or station |
| landing | Landing day and the next 72 hours | Landing event record; G-TRANSIT active |
| surface | Moon or Mars surface, 72 hours after landing | Mission phase: surface |
| suit | Inside the spacesuit | EVA display active |

In microgravity no free water is used (wet cloth, cold pack, the closed head of the eyewash kit), the "raise the legs" step is skipped, and instead of "recovery position" the person is secured with the head turned to the side. In landing and surface environments, fainting-related instructions open the G-TRANSIT panel.

### Step list and automatic monitoring

- Each step has a large ✓ Done button; pressing it records the time and who pressed it. A "Could not do" button asks for the reason (no kit, no training, the person refused).
- Intervals such as "every 5 minutes" become countdowns. When the time is up the panel reads the value from the sensor; without a sensor it asks a crewmate to enter it.
- "If it gets worse" conditions use the same values as the main panel's threshold tables. When triggered, the panel suggests the target instruction; the crew moves with one press.
- For suspected sepsis qSOFA is used (proposal): breathing ≥22/min, systolic ≤100 mmHg, altered consciousness; if at least two are present A-SEPSIS is suggested.
- **Several outcomes:** if more than one label is selected at S4, or an instruction triggers another, the next instruction waits below the card and opens when the "Do now" steps of the current one are done.

### Environment routing rule (A-ENVIRONMENT or C-ENVIRONMENT-CO2)

When "the same sign in more than one person" or "cabin O₂ / CO₂ alarm" is selected at G1, and when GN2a is answered "Yes", the panel applies this rule:

- **A-ENVIRONMENT (EMERGENCY)** if any of these holds: cabin ppO₂ or pressure red in Table A; cabin CO₂ 1-hour mean at the emergency limit (`thresholds.yaml`, proposal 4.0 mmHg); SpO₂ ≤91 in an affected person; altered consciousness; no sensor data.
- **C-ENVIRONMENT-CO2 (PRIORITY)** if none of the above holds.

## Stage 0: Safety and person

The tree starts with three selection screens. G1 is shown every time; a safety problem, if any, is selected on the screen, otherwise it is skipped with one press. G2 sets who the panel is opened for. G3 is shown only if the panel is opened for someone else.

### G1 · Safety screen

On screen: "Is there a safety problem in the environment? Select any that apply, or press 'No problem'." Several options can be selected. Options with a sensor alarm or symptom record come pre-selected and highlighted; the person confirms or removes them.

| Option | Hint (small text) | Goes to |
| --- | --- | --- |
| Smoke, burning smell or fire alarm | | A-ENVIRONMENT |
| Pressure drop or leak alarm | Cabin or module pressure | A-ENVIRONMENT |
| Toxic gas, chemical smell or leak | E.g. ammonia from the cooling system | A-ENVIRONMENT |
| Headache, dizziness or shortness of breath in more than one person at the same time | | Environment routing rule: A-ENVIRONMENT or C-ENVIRONMENT-CO2 |
| Cabin O₂ or CO₂ alarm | | Environment routing rule |
| No problem | | G2 |
| Not sure | Live cabin values and alarm states are shown on screen | A-ENVIRONMENT if a value is red; otherwise G2, with the note "environment could not be checked" in the package |

The first step of A-ENVIRONMENT is "put on your own mask": the helper protects themselves before looking at the person. When the A-ENVIRONMENT steps are done the panel continues from G2, so each affected person can be assessed in turn.

### G2 · Who for?

On screen: "Who did you open this panel for?" Buttons: Myself and the crew list from the mission settings (name and role, e.g. "A1 · Commander", "A2 · Crew Medical Officer"). The person who raised the alarm is highlighted.

| Choice | What happens | Goes to |
| --- | --- | --- |
| Myself | Questions are asked to the person who opened the panel ("you"); the consciousness screen is skipped | S4 |
| A crewmate | The panel loads the chosen person's sensors, medication and allergy records; questions are asked about "them". If the chosen person is the CMO, CMO patient mode starts | G3 |
| Not sure | If the affected person is unclear (e.g. several people), the panel suggests the person with the worst sensor values | G3 |

If several people are affected, the person in the worst condition is chosen first. The instruction card has a "+ Open for another person" button; a separate session is opened for each person and the packages are linked. If the person opening the panel is the CMO and chooses "Myself", CMO patient mode also starts.

### G3 · Consciousness and breathing (only for someone else)

On screen: "Tap the shoulder and call out loudly. Watch the chest rise and fall for 10 seconds. Which is it?" If sensors are available, SpO₂, pulse and breathing rate are shown, but the crewmate makes the decision.

| Option | Goes to |
| --- | --- |
| Responds when called | S4 |
| Does not respond, breathing normally | EMERGENCY · A-CONSCIOUSNESS |
| Does not respond; not breathing or breathing abnormally (gasping, irregular) | EMERGENCY · A-CPR |
| Not sure | The panel repeats the check with a 10-second countdown. If still not sure, A-CPR. If the person moves or speaks, CPR stops and the flow continues from S4 |

## Stage 1: Rapid triage

S4 is always shown. Each red flag is a separate large button and goes straight to its own outcome; "None of these" moves to Stage 1b. The T questions are asked in order only if "Something else / not sure" is selected.

### S4 · Red flag screen

On screen: "Is any of these present?" Several labels can be selected.

| Label | Goes to |
| --- | --- |
| Bleeding that will not stop | EMERGENCY · A-BLEEDING |
| Swelling of lips, tongue or throat | EMERGENCY · A-ANAPHYLAXIS |
| Pressure or tightness in the chest | EMERGENCY · A-HEART |
| Feeling about to faint | T4a (pre-filled from the ECG) |
| Abdominal pain too severe to touch | EMERGENCY · A-ABDOMEN |
| Fever with confusion | EMERGENCY · A-SEPSIS |
| Sudden loss of vision or chemical in the eye | EMERGENCY · A-EYE |
| Slurred speech, drooping face | EMERGENCY · A-BRAIN |
| Very sudden, very severe headache | EMERGENCY · A-BRAIN |
| Thoughts of self-harm | EMERGENCY · A-PSYCH |
| Overheating and confusion | EMERGENCY · A-HEAT |
| Something else / not sure | Ordered questions starting at T1 |
| None of these | X1 |

**Order when several are selected:** airway and circulation first: A-ANAPHYLAXIS → A-BLEEDING → A-HEART → A-RHYTHM → A-BRAIN → A-HEAT → A-SEPSIS → A-ABDOMEN → A-EYE. If A-PSYCH is selected, the step "Do not leave the person alone, assign a companion" is added to the top of the first instruction and A-PSYCH waits as the next instruction.

### T questions (ordered flow)

In the T questions "Not sure" always goes to the "Yes" branch; no EMERGENCY outcome is lost.

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| T1 | Is there bleeding that will not stop? | | EMERGENCY · A-BLEEDING | T2 |
| T2 | Have the lips, tongue or throat swollen? | | EMERGENCY · A-ANAPHYLAXIS | T2a |
| T2a | Is there an itchy rash with raised bumps all over the body? | | T2b | T3 |
| T2b | Is there shortness of breath or dizziness? | | EMERGENCY · A-ANAPHYLAXIS | T3 |
| T3 | Is there pressure, tightness or crushing in the chest? | The pain may spread to the arm, jaw or back. | EMERGENCY · A-HEART | T4 |
| T4 | Is the person about to faint? | | T4a | T5 |
| T4a | Is the heart beating very fast, very slowly or irregularly? | The panel fills this in from the ECG. | EMERGENCY · A-RHYTHM | PRIORITY · C-FAINTING |
| T5 | Is the abdominal pain too severe to touch? | | EMERGENCY · A-ABDOMEN | T5a |
| T5a | Is the vomiting not stopping and no gas passing? | | EMERGENCY · A-ABDOMEN | T6 |
| T6 | Is there fever or shivering? | The panel fills this in from core temperature. | T6a | T7 |
| T6a | Is there confusion or unusual sleepiness? | | EMERGENCY · A-SEPSIS | T6b |
| T6b | Is the breathing very fast, or the skin cold and pale? | The panel shows the breathing rate. | EMERGENCY · A-SEPSIS | T7 |
| T7 | Has vision suddenly decreased? | | EMERGENCY · A-EYE | T7a |
| T7a | Has a chemical or a sharp object got into the eye? | | EMERGENCY · A-EYE | T8 |
| T8 | Is there a drooping face, slurred speech or weakness on one side? | Ask them to smile, raise both arms and say a sentence. | EMERGENCY · A-BRAIN | T8a |
| T8a | Is it a sudden, very severe headache? | Like "the worst headache of my life". | EMERGENCY · A-BRAIN | T9 |
| T9 | Are there thoughts of self-harm? | | EMERGENCY · A-PSYCH | T10 |
| T10 | Is there confusion together with overheating? | Hot, flushed skin; after exercise or EVA. The panel shows core temperature. | EMERGENCY · A-HEAT | X1 |

## Stage 1b: Context

The panel fills in X1 and X2 from its records; the person confirms. "Yes" answers are kept as flags: the EVA flag enables M0 and KS1; the RAD flag adds the C-RAD-MONITOR steps to every outcome except A-RAD. In this stage "Not sure" goes to the "Yes" branch.

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| X1 | Was there an EVA, or did pressure drop, in the last 24 hours? | EVA = spacewalk. Pressure: cabin or suit. The panel fills this in from the EVA log. | X1a (EVA flag set) | X2 |
| X1a | Is there a deep, aching pain in the joints? | Especially shoulder, elbow, knee. | EMERGENCY · A-DCS | X1c |
| X1c | Is there numbness or weakness in an arm or leg? | Answer "No" if only in the fingertips. | EMERGENCY · A-DCS | X1d |
| X1d | Is there shortness of breath, cough or stabbing chest pain? | | EMERGENCY · A-DCS | X1e |
| X1e | Are there mottled, purplish patches on the skin? | | EMERGENCY · A-DCS | X2 |
| X2 | Was there a radiation or solar storm warning? | The panel fills this in from RadLab and DONKI. | X2a (RAD flag set) | M0 |
| X2a | Did nausea or vomiting start after the warning? | | EMERGENCY · A-RAD | X2b |
| X2b | Is there sunburn-like redness on the skin? | If "No", radiation monitoring steps are added to the outcome. | EMERGENCY · A-RAD | M0 |

## Stage 2: Main sorting

"Yes" enters the branch of that region; "No" rules out the conditions of that region. The order follows the size of the group and how often it occurs on the ISS. "Not sure" enters the branch; if the branch ends in its general MONITOR outcome the panel returns to the next M question.

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| M0 | Is the problem in the hand or fingers? | Asked only if the EVA flag is set. Bruising under the nail, nail lifting, glove rubbing. | MONITOR · C-EVA-HAND | M1 |
| M1 | Did it start after a blow, fall, cut or burn? | Strain during exercise also counts. | TR1 (Trauma) | M2 |
| M2 | Is the problem in the head, face, eyes, throat or teeth? | | BY1 (Head-face) | M3 |
| M3 | Is there a rash, redness or itching on the skin? | | CL1 (Skin) | M4 |
| M4 | Is the problem in the abdomen, the sides of the lower back or when passing urine? | | K1 (Abdomen-urine) | M5 |
| M5 | Is there pain or numbness in the arms, legs, back or joints? | | KS1 (Musculoskeletal) | M6 |
| M6 | Is it a general illness affecting the whole body? | Dizziness, nausea, shortness of breath, extreme tiredness. | GN1 (General) | M7 |
| M7 | Is the problem about sleep, mood or stress? | | PS1 (Sleep-mood) | MONITOR · C-UNCLEAR |

## Stage 3: Branch questions

In every branch the dangerous possibility is asked first, then the most common condition. If no question gets a "Yes", the general MONITOR outcome of the branch is given. In branch questions "Not sure" goes to the higher-level outcome.

### Trauma branch

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| TR1 | Is it a burn? | Hot surface, hot water, electricity, chemical. | TR1a | TR2 |
| TR1a | Is it an electrical or chemical burn? | | PRIORITY · C-BURN-SEVERE | TR1b |
| TR1b | Is the burn larger than the palm of the hand? | | PRIORITY · C-BURN-SEVERE | TR1c |
| TR1c | Is the burn on the face, hand, a joint or the genital area? | | PRIORITY · C-BURN-SEVERE | TR1d |
| TR1d | Is the burnt skin white, brown or without feeling? | | PRIORITY · C-BURN-SEVERE | MONITOR · C-BURN-MINOR |
| TR2 | Was the blow to the head? | | TR2a | TR3 |
| TR2a | Did the person pass out briefly or not remember the event? | | PRIORITY · C-HEAD-SEVERE | TR2b |
| TR2b | Is there vomiting, a worsening headache or confusion? | | PRIORITY · C-HEAD-SEVERE | MONITOR · C-HEAD-MINOR |
| TR3 | Was the blow to the eye? | | PRIORITY · C-EYE-TRAUMA | TR4 |
| TR4 | Is there a cut, graze or puncture? | | TR4a | TR5 |
| TR4a | Did the bleeding stop after 10 minutes of pressure? | "Not sure" → No. | TR4b | PRIORITY · C-CUT-DEEP |
| TR4b | Is the cut deep, or do its edges stay open? | It is deep if fat or muscle is visible. | PRIORITY · C-CUT-DEEP | TR4c |
| TR4c | Is the cut on the face, hand or a joint? | | PRIORITY · C-CUT-DEEP | MONITOR · C-CUT-MINOR |
| TR5 | Is the injured area deformed, or is bone sticking out? | | PRIORITY · C-FRACTURE-OPEN | TR5a |
| TR5a | Can the injured area not be moved at all? | | PRIORITY · C-FRACTURE-OPEN | TR6 |
| TR6 | Is there sharp pain at one point when pressing on the bone? | | PRIORITY · C-FRACTURE-SUSPECTED | TR6a |
| TR6a | Is the swelling or bruising growing quickly? | | PRIORITY · C-FRACTURE-SUSPECTED | MONITOR · C-STRAIN |

### Head-face branch (eyes, teeth, breathing, headache)

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| BY1 | Is the problem in the eye? | | EY1 | BY2 |
| EY1 | Is there redness, stinging or watering in the eye? | | EY1a | EY2 |
| EY1a | Does the person wear contact lenses? | "Yes" also if worn in the last 24 hours. | MONITOR · C-LENS | EY1b |
| EY1b | Could dust or a crumb have got into the eye? | | MONITOR · C-EYE-FOREIGN-BODY | MONITOR · C-EYE-IRRITATION |
| EY2 | Has vision become slowly blurred over days? | Especially if reading close up has become harder. | PRIORITY · C-SANS | EY2a |
| EY2a | Is there a shadow or blind spot in the vision? | | PRIORITY · C-SANS | MONITOR · C-EYE-GENERAL |
| BY2 | Is there pain in a tooth, the gums or the jaw? | | DS1 | BY3 |
| DS1 | Is there swelling in the face or jaw? | | PRIORITY · C-TOOTH-ABSCESS | DS1a |
| DS1a | Is there a pus-filled bump on the gum or a bad taste in the mouth? | | PRIORITY · C-TOOTH-ABSCESS | DS2 |
| DS2 | Did a tooth break or a filling fall out? | | MONITOR · C-TOOTH-FRACTURE | MONITOR · C-TOOTH-PAIN |
| BY3 | Is there a blocked nose, discharge, sore throat or cough? | | R1 | BY4 |
| R1 | Is there fever or chills and shivering? | The panel fills this in from core temperature. | R1a | R1b |
| R1b | Is there a sore throat or yellow-green discharge? | The question that separates an infection from the fluid shift in space. | R1a | R2 |
| R1a | Is there shortness of breath or wheezing in the chest? | | PRIORITY · C-BREATHING-SEVERE | R1c (if R1 is "Yes"); otherwise MONITOR · C-BREATHING |
| R1c | Has the fever lasted longer than 3 days? | Asked only if R1 is "Yes". | PRIORITY · C-BREATHING-SEVERE | MONITOR · C-BREATHING |
| R2 | Did it start after contact with a new substance or food? | With sneezing, itching, watery discharge. | MONITOR · C-ALLERGY-MILD | MONITOR · C-CONGESTION |
| BY4 | Is headache the main complaint? | | H1a | BY5 |
| H1a | Was the person working in a poorly ventilated place? | Or if cabin CO₂ looks high. The panel fills this in from CO₂. | MONITOR · C-CO2 | H2 |
| H2 | Is there shortness of breath or blue lips? | | PRIORITY · C-HYPOXIA | H3 |
| H3 | Is the nose blocked, or is there a feeling of fullness in the face? | | MONITOR · C-CONGESTION | H4 |
| H4 | Is the vision blurred? | | PRIORITY · C-SANS | H5 |
| H5 | Did it start after lack of sleep or stress? | | MONITOR · C-SLEEP | MONITOR · C-HEADACHE |
| BY5 | Is there a feeling of fullness in the face or ears? | | MONITOR · C-CONGESTION | MONITOR · C-UNCLEAR |

Version 2's H1 ("Do others in the same module also have a headache?") was removed: this is now asked at G1 and goes to the environment routing rule.

### Skin branch

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| CL1 | Did the rash appear after a new medicine, food or cream? | | MONITOR · C-ALLERGY-MILD | CL1a |
| CL1a | Is it in the form of itchy raised bumps? | Bumps like mosquito bites (hives). | MONITOR · C-ALLERGY-MILD | CL3 |
| CL3 | Is the rash warm, swollen or spreading? | | PRIORITY · C-SKIN-INFECTION | CL3a |
| CL3a | Is there pus or fever? | | PRIORITY · C-SKIN-INFECTION | CL4 |
| CL4 | Are there painful blisters filled with fluid? | Often on one side of the body, in a band. | PRIORITY · C-SKIN-BLISTER | MONITOR · C-DERMATITIS |

### Abdomen-urine branch

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| K1 | Is there burning or pain when passing urine? | | K1a | K1b |
| K1b | Is the person passing urine very often, or is the urine cloudy? | | K1a | K2 |
| K1a | Is there also fever, shivering or lower-back pain? | | PRIORITY · C-UTI-SEVERE | MONITOR · C-UTI |
| K2 | Does the pain spread from one side of the lower back towards the groin? | Pain that comes in waves and makes the person writhe. | PRIORITY · C-KIDNEY-STONE | K2a |
| K2a | Is the urine pink or red? | | PRIORITY · C-KIDNEY-STONE | K3 |
| K3 | Is the pain in the lower right part of the abdomen? | It may have started around the navel and moved to the lower right. | PRIORITY · C-APPENDICITIS | K4 |
| K4 | Has the person been unable to pass stool for several days? | | K4a | K5 |
| K4a | Is there vomiting, or is no gas passing either? | | EMERGENCY · A-ABDOMEN | MONITOR · C-CONSTIPATION |
| K5 | Did the nausea start in the first days of flight? | Or after a change in gravity. | MONITOR · C-ADAPTATION | K5a |
| K5a | Does the nausea get worse with head movements? | | MONITOR · C-ADAPTATION | MONITOR · C-ABDOMEN-GENERAL |

### Musculoskeletal branch

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| KS1 | Did the pain or numbness start after an EVA? | Asked only if the EVA flag is set. | KS1a | KS2 |
| KS1a | Is the numbness only in the fingertips? | The points where the glove presses. | KS1b | EMERGENCY · A-DCS |
| KS1b | Is the numbness getting less? | | MONITOR · C-EVA-HAND | EMERGENCY · A-DCS |
| KS2 | Is it lower-back pain? | | KS2a | KS3 |
| KS2a | Does pulling the knees to the chest relieve it? | | MONITOR · C-BACK | KS3 |
| KS3 | Is there sharp pain at one point over a bone? | Even if no blow is remembered. Bones weaken in space. | PRIORITY · C-FRACTURE-SUSPECTED | KS4 |
| KS4 | Did it start after exercise or a sudden movement? | | MONITOR · C-STRAIN | KS5 |
| KS5 | Does the pain spread down the arm or leg? | Like an electric shock. | MONITOR · C-NERVE | MONITOR · C-MUSCLE-GENERAL |

### General illness branch

| Code | Question | Hint (small text) | Yes → | No → |
| --- | --- | --- | --- | --- |
| GN1 | Is it the first days of flight, or has gravity just changed? | E.g. landing on the Moon / Mars surface, return to Earth. | GN1a | GN2 |
| GN1a | Do nausea or dizziness get worse when the head moves? | | MONITOR · C-ADAPTATION | GN2 |
| GN2 | Is there shortness of breath or quick tiring? | | GN2a | GN3 |
| GN2a | Do others have the same sign? | The panel fills this in from symptom records. | Environment routing rule | GN2b |
| GN2b | Are the cabin oxygen and pressure values normal? | The panel fills this in from the cabin sensors. "Not sure" → No. | PRIORITY · C-HYPOXIA | EMERGENCY · A-ENVIRONMENT |
| GN3 | Is there fever or shivering? | The panel fills this in from core temperature. | GN3a | GN4 |
| GN3a | Is there burning when passing urine? | | PRIORITY · C-UTI-SEVERE | MONITOR · C-FEVER |
| GN4 | Is there a feeling of palpitations? | | MONITOR · C-PALPITATIONS | GN5 |
| GN5 | Is there also sleeplessness, unhappiness or anxiety? | | PS1 (Sleep-mood) | MONITOR · C-FATIGUE |

### Sleep and mood branch

| Code | Question | Yes → | No → |
| --- | --- | --- | --- |
| PS1 | Are there thoughts of self-harm? | EMERGENCY · A-PSYCH | PS2 |
| PS2 | Are there attacks of sudden fear and being unable to breathe? | MONITOR · C-PANIC | PS3 |
| PS3 | Has the person had trouble sleeping for several days? | MONITOR · C-SLEEP | PS3a |
| PS3a | Is there excessive sleepiness during the day? | MONITOR · C-SLEEP | PS4 |
| PS4 | Has the person felt low or unmotivated on most days for two weeks? | MONITOR · C-LOW-MOOD | MONITOR · C-STRESS |

## Instructions: EMERGENCY (15)

In EMERGENCY instructions the package goes in the first communication window with the highest priority. "Per kit procedure" means the medication and dose are defined in the mission medical kit procedure and the CMO decides; at this step the panel shows the remaining stock and the expiry date. The codes after each title (U13, D9…) refer to the [coverage table](#coverage).

### A-ENVIRONMENT · Cabin atmosphere hazard · U13, U9, U10

Entry: smoke, pressure or gas option at G1; the EMERGENCY condition of the environment routing rule; GN2b "No".

**Do now**
1. Put on your own mask.
2. Raise the alarm, warn the crew.
3. If there is a fire, cut the power and extinguish it per mission procedure.
4. Move the affected person to a module with clean air and close the hatch.
5. Give the affected person oxygen by mask.

**While waiting for communication**
- Check consciousness, breathing and SpO₂ every 5 minutes.
- If the eyes burn, rinse them. μg: with the closed head of the eyewash kit, without free water.
- Record cabin O₂, CO₂, pressure and contaminant values (the panel records them itself).
- Do not leave the clean module until the readings are back to normal.
- When the steps are done the panel returns to G2; each affected person is assessed separately.

**Automatic monitoring:** SpO₂, consciousness question and cabin values every 5 minutes.
**When communication returns:** time of the event, cabin readings, affected people and their signs.
**If it gets worse:** SpO₂ ≤85 or no answer to the consciousness question → A-CONSCIOUSNESS; no breathing → A-CPR.

### A-CPR · Unconscious, not breathing: possible cardiac arrest · D9

**Do now**
1. Call the crew loudly.
2. Secure the person:
   - μg: strap them to a hard surface, secure yourself too; use the microgravity CPR technique of the mission procedure.
   - landing / surface: lay them on their back on the floor.
   - suit: CPR is not possible in a spacesuit. An emergency return to the airlock starts; this instruction continues once the suit is off.
3. Start chest compressions at once: centre of the chest, 100–120 per minute, 5–6 cm deep.
4. A second person attaches the AED and follows its voice prompts.
5. If trained, give 2 breaths after every 30 compressions or use a bag-valve mask with oxygen.

**While waiting for communication**
- Change the person doing compressions every 2 minutes (the panel shows a countdown).
- Follow the AED prompts; keep going without stopping.
- A third person keeps the record; with a crew of 2 the panel records the times and AED events itself.

**Automatic monitoring:** ECG and AED events continuously; 2-minute timer for changing the compressor.
**When communication returns:** CPR start time, number of AED shocks, result, ECG record.
**If it improves:** if the person moves or breathes → A-CONSCIOUSNESS.

### A-CONSCIOUSNESS · Unconscious but breathing · D9, U13, D8, D3, U9

**Do now**
1. Make sure the environment is safe (the G1 answer is shown on screen).
2. Keep the airway open:
   - μg: secure with straps, keep the head turned to the side; have a vomit bag and suction (if in the kit) ready.
   - landing / surface: recovery position.
   - suit: the partner comes over and checks consciousness by voice every minute; emergency return to the airlock.
3. Attach pulse, SpO₂, blood pressure, ECG and temperature sensors.
4. Measure blood glucose (i-STAT). If below 55 mg/dL, glucagon or intravenous glucose per kit procedure (trained person, double check).
5. If SpO₂ is low, give oxygen by mask.

**While waiting for communication**
- Watch the breathing continuously; if it stops, start CPR at once.
- Record the readings every 5 minutes (the panel reads them itself).
- Note what happened before: EVA, blow, medication, food, fever, chest pain. The panel shows the last 24 hours of records on screen.

**Automatic monitoring:** SpO₂, pulse, blood pressure, ECG every 5 minutes.
**When communication returns:** time consciousness was lost, sensor records, blood glucose, notes on what happened before.
**If it gets worse:** no breathing or no pulse → A-CPR.

### A-BLEEDING · Serious bleeding · D1, D7

**Do now**
1. Put on gloves; use an absorbent pad so blood droplets do not spread.
2. Press on the wound with gauze continuously; do not lift it.
3. If blood soaks through, add a new pad on top of the old one.
4. If it does not stop on an arm or leg, apply the tourniquet 5–8 cm above the wound; the panel records the tourniquet time.

**While waiting for communication**
- Keep pressing for at least 10 minutes.
- Keep the person warm.
- Check pulse, blood pressure and consciousness every 5 minutes.
- When the bleeding stops, close the wound and go to C-CUT-DEEP.

**Automatic monitoring:** pulse and blood pressure every 5 minutes; tourniquet time.
**When communication returns:** wound location, tourniquet time, estimated loss, readings, photo.
**If it gets worse:** pulse >120 and systolic ≤90 mmHg (proposal), paleness, sweating or confusion (shock) → give oxygen; landing / surface: raise the legs; μg: skip the position step, intravenous fluid per kit procedure (trained person). A tourniquet on for more than 2 hours raises the package priority (proposal). suit: if the bleeding comes with a suit puncture, the pressure rule of the EVA panel applies.

### A-ANAPHYLAXIS · Possible severe allergic reaction (anaphylaxis) · D3

**Do now**
1. Give the adrenaline auto-injector into the outer thigh at once; do not wait. The panel shows how many injectors are left.
2. Remove the trigger (food, medicine, material).
3. Give oxygen by mask.
4. Position: half-sitting if short of breath. If dizzy, landing / surface: legs up; μg: skip the position step and secure the person.

**While waiting for communication**
- Measure pulse, SpO₂ and blood pressure every 5 minutes.
- If there is no improvement in 5–15 minutes, give the second dose (per kit procedure, double check).
- Give the allergy medicine per kit procedure.
- Even if better, stay with the person for at least 4–6 hours; the signs can come back (the panel counts the observation time).

**Automatic monitoring:** pulse, SpO₂, blood pressure every 5 minutes; 5–15-minute timer for the second dose; 4–6-hour observation counter.
**When communication returns:** trigger, injection times, readings, adrenaline stock left.
**If it gets worse:** systolic ≤90 or SpO₂ ≤91 still present at 15 minutes → second-dose alert (with a "last dose" note if the stock is 1). If breathing stops → A-CPR.

### A-HEART · Possible heart attack · D9

**Do now**
1. Stop all activity, secure the person.
2. Attach and record the ECG at once.
3. If SpO₂ is low, give oxygen.
4. Bring the AED to the person.
5. Give aspirin per kit procedure; not if allergic (the panel shows the allergy record, double check).

**While waiting for communication**
- Record ECG and blood pressure continuously.
- Ask for pain severity (1–10) every 10 minutes and write it down.
- If the EVA flag is set, also apply the A-DCS steps.
- Pain relief and other medication: per kit procedure.

**Automatic monitoring:** ECG continuously; blood pressure and pain score every 10 minutes.
**When communication returns:** pain start time, ECG records, medication given and times.
**If it gets worse:** VT >32 beats, pause >3 s or loss of consciousness → A-CPR + AED.

### A-RHYTHM · Possible heart rhythm disorder · D9

**Do now**
1. Secure the person; landing / surface: lying down.
2. Attach and record the ECG.
3. Keep the AED attached and ready.

**While waiting for communication**
- Watch pulse, blood pressure and SpO₂ continuously.
- Note triggers: caffeine, lack of sleep, fluid loss, medication.
- Do not leave the person alone.

**Automatic monitoring:** ECG continuously; pulse, blood pressure, SpO₂ every 5 minutes.
**When communication returns:** time of the signs, ECG rhythm records.
**If it gets worse:** loss of consciousness → A-CPR + AED. Systolic ≤90 → package highest priority.

### A-ABDOMEN · Acute abdomen (appendicitis, bowel obstruction, etc.) · D6

**Do now**
1. Stop food and drink by mouth.
2. Secure the person in the position they find most comfortable.
3. Do not press on or massage the abdomen.
4. Measure temperature, pulse and blood pressure.

**While waiting for communication**
- Record the readings every 15 minutes; write down the number of vomits.
- If ultrasound is available, take and store images per procedure.
- Pain relief and antibiotics: per kit procedure (double check for antibiotics).

**Automatic monitoring:** temperature, pulse, blood pressure every 15 minutes; qSOFA.
**When communication returns:** readings, ultrasound images, medication given. Ask for information for an evacuation or surgery decision.
**If it gets worse:** qSOFA ≥2 → A-SEPSIS.

### A-SEPSIS · Possible sepsis (infection spreading through the body) · D8, D2

**Do now**
1. Measure temperature, pulse, breathing, blood pressure and SpO₂.
2. If SpO₂ is low, give oxygen.
3. Start the antibiotic without waiting (per kit procedure, double check).

**While waiting for communication**
- Give fluids: by mouth if able to swallow, otherwise intravenously (trained person).
- Look for the source of infection: urine, cough, wound, abdomen.
- Check consciousness and readings every 15 minutes.

**Automatic monitoring:** temperature, pulse, breathing, blood pressure, SpO₂ every 15 minutes.
**When communication returns:** readings, antibiotic time, possible source.
**If it gets worse:** if systolic stays ≤90 the fluid step moves up; if consciousness falls → A-CONSCIOUSNESS.

### A-EYE · Eye emergency · D5, U7

**Do now**
1. If a chemical got in: rinse with the eyewash kit for at least 15 minutes. μg: with the closed head of the kit, without free water.
2. Do not remove an embedded object; cover the eye with a rigid shield without pressing.
3. Stop the person rubbing the eye.

**While waiting for communication**
- Remove contact lenses if present (after rinsing out a chemical).
- Test and record the vision of each eye separately.
- Pain relief: per kit procedure.

**Automatic monitoring:** vision test reminder every hour (proposal).
**When communication returns:** time of the event, vision test results, photo.
**If it gets worse:** if vision loss progresses, the package goes with the highest priority.

### A-BRAIN · Possible stroke / brain emergency · outside the list

**Do now**
1. Write down the time the signs started (the panel suggests the time of the S4 or T8 answer).
2. Secure the person; give nothing by mouth.
3. Measure blood glucose (i-STAT). Low blood glucose can mimic stroke signs: if low, correct it per kit procedure and repeat the face-arm-speech test.
4. If SpO₂ is low, give oxygen.

**While waiting for communication**
- Repeat and record the face-arm-speech test every 15 minutes.
- Record blood pressure, pulse and SpO₂.
- In case of vomiting: landing / surface: lay them on their side; μg: secure with the head turned to the side, vomit bag and suction ready.

**Automatic monitoring:** face-arm-speech test reminder every 15 minutes; blood pressure, SpO₂.
**When communication returns:** start time, test results, blood glucose, readings.
**If it gets worse:** loss of consciousness → A-CONSCIOUSNESS.

### A-DCS · Possible decompression sickness · U8

**Do now**
1. Give 100 % oxygen at once.
2. Repressurise: in the cabin or habitat per mission procedure; suit: raise the suit pressure per procedure and return to the airlock.

**While waiting for communication**
- Assess joint pain, numbness, vision and breathing every 15 minutes.
- Give fluids, let the person rest.
- Record the times of the signs; the panel adds the EVA pressure profile to the package.

**Automatic monitoring:** assessment reminder every 15 minutes; SpO₂.
**When communication returns:** EVA profile, times of the signs, pressure and oxygen applied.
**If it gets worse:** a new neurological sign or shortness of breath → package highest priority; if consciousness falls → A-CONSCIOUSNESS.

### A-RAD · Signs of acute radiation exposure · U12

**Do now**
1. Move the crew to the shielded area (storm shelter).
2. Write down the time of the first vomit; it is the most important information about the size of the exposure. The panel suggests the time from the symptom record.

**While waiting for communication**
- Record dosimeter and module radiation values (the panel records them itself).
- Replace lost fluids.
- Anti-nausea medicine: per kit procedure.
- Protect reddened skin; do not scratch.

**Automatic monitoring:** dosimeter and RadLab dose rate continuously.
**When communication returns:** time of the first vomit, dose values, signs.
**If it gets worse:** if the dose rate turns red, the shelter alert is repeated to the whole crew.

### A-PSYCH · Risk of self-harm · U6

**Do now**
1. Do not leave the person alone; talk calmly and without judging.
2. Put sharp tools and medicines in a safe place.
3. Assign a crew member as a constant companion.

**While waiting for communication**
- Keep the companion present without a break; change in shifts (the panel keeps a shift rota).
- Keep talking with the person and listening.

**Automatic monitoring:** companion shift timer; alarm to the crew if there is a gap.
**When communication returns:** ask for a call with the psychological support team in the first communication window.

### A-HEAT · Heat stroke / overheating · new

Entry: "Overheating and confusion" at S4 or T10 "Yes"; sensor: core temperature ≥40.0 °C at any time, or ≥39.1 °C at rest together with confusion or dizziness; G-TRANSIT heat override.

**Do now**
1. Stop activity at once.
2. Cool down:
   - suit: set the cooling water flow to maximum; the EVA panel starts the return.
   - μg: remove layers of clothing, use a wet cloth and a fan, put cold packs on the neck, armpits and groin; no free water.
   - landing / surface: the same steps; also lay the person down.
3. If conscious and able to swallow, give fluids.
4. Measure blood glucose (i-STAT).

**While waiting for communication**
- Keep cooling until core temperature falls below 38.5 °C (proposal).
- Watch pulse, blood pressure and SpO₂.
- Intravenous fluid per kit procedure (if unable to swallow, trained person).

**Automatic monitoring:** core temperature every 5 minutes; pulse, blood pressure, SpO₂.
**When communication returns:** temperature curve, time cooling started, effort and suit data before the event.
**If it gets worse:** falling consciousness or a seizure → A-CONSCIOUSNESS. If the temperature does not fall within 30 minutes, the package goes with the highest priority.

## Instructions: PRIORITY (17)

In PRIORITY instructions the package goes in the first communication window. The steps are carried out within hours and monitored regularly.

### C-ENVIRONMENT-CO2 · Gradual CO₂ rise, mild signs in the crew · U10, U13 · new

Entry: none of the EMERGENCY conditions of the environment routing rule: CO₂ raised but below the emergency limit, SpO₂ >91, consciousness normal.

**Do now**
1. Move the affected people to a module with strong ventilation; switch on local fans.
2. Check the CO₂ removal system (CDRA) per mission procedure; if faulty, switch to the backup system.
3. Stop exercise and heavy work.
4. Measure the SpO₂ of everyone affected.

**While waiting for communication**
- Drink water; pain relief if needed (per kit procedure).
- Give the 20-minute Cognition test and the Amsler grid test to those with signs.
- Postpone critical tasks (EVA, robotic arm, docking) until CO₂ is below the yellow band; the red gate on the readiness card shows this.

**Automatic monitoring:** cabin CO₂ 1-hour mean and the SpO₂ of those affected, every 15 minutes.
**When communication returns:** CO₂ curve, CDRA state, those affected and the severity of their signs, test scores.
**If it gets worse:** CO₂ above the emergency limit, SpO₂ ≤91 in anyone, or nausea, confusion or fast breathing starts → A-ENVIRONMENT.

### C-FAINTING · Feeling faint (heart rhythm looks normal) · D9

**Do now**
1. Secure the person; measure pulse, blood pressure and ECG.
2. Measure blood glucose (i-STAT). If below 70 mg/dL and able to swallow, give a sugary drink or glucose (per kit procedure).
3. By environment:
   - landing / surface: lay down, raise the legs. The G-TRANSIT panel opens; its recommendations (COOL_UP, FLUID_IF_ABLE, OIG_STAGE2, RECLINE, DELAY_EGRESS) are added to this list as steps with a confirm button.
   - μg: no position step; feeling faint is rare in microgravity. If ECG and blood glucose are normal, ask about fluids, sleep and medication.
   - suit: sit or lie down, the partner comes over, the EVA ends (orthostatic rule of the EVA panel).

**While waiting for communication**
- Give fluids; ask the time of the last meal.
- Prevent sudden standing and fast movement. landing: standing up is gradual, following G-TRANSIT's SLOW_STAND recommendation.

**Automatic monitoring:** blood pressure and pulse every 15 minutes; ECG continuously; on landing / surface, ORI and time to fainting.
**When communication returns:** readings, time of the event, last meal and fluid intake, blood glucose, G-TRANSIT summary (if any).
**If it gets worse:** irregular ECG or pulse <40 or >150 → A-RHYTHM; chest pain → A-HEART; ORI ≥80, perfusion margin <5 mmHg or loss of consciousness → A-CONSCIOUSNESS; blood glucose <55 mg/dL → glucose per kit procedure (glucagon if unable to swallow), package EMERGENCY.

### C-BURN-SEVERE · Severe burn · D1

**Do now**
1. Remove the source (if electrical, cut the power first).
2. If chemical, rinse. μg: with an absorbent pad, without spreading free water.
3. Cool the burn for 20 minutes (not ice). μg: wet sterile cloth or cold pack; landing / surface: cool water or a wet cloth.

**While waiting for communication**
- Remove jewellery; do not pull off fabric that is stuck.
- Cover loosely with a non-stick sterile dressing.
- Keep the person from getting cold; give fluids.
- Pain relief: per kit procedure.

**Automatic monitoring:** pulse and blood pressure every hour (proposal); breathing question every 15 minutes for a burn of the face or neck.
**When communication returns:** location and size of the burn, photo.
**If it gets worse:** face or neck burn with hoarseness or difficulty breathing → give oxygen, package EMERGENCY.

### C-HEAD-SEVERE · Signs of serious head injury · outside the list

**Do now**
1. Keep the person still and secured; if the neck hurts, do not move the neck.
2. Measure and record blood glucose (i-STAT).

**While waiting for communication**
- Check consciousness, pupils, speech and arm and leg strength every 15 minutes.
- If the person sleeps, wake them at regular intervals.
- Pain relief: per kit procedure.

**Automatic monitoring:** neurological check reminder every 15 minutes.
**When communication returns:** time of the event, check records, blood glucose.
**If it gets worse:** falling consciousness, repeated vomiting or weakness on one side → A-BRAIN.

### C-CUT-DEEP · Deep cut · D1

**Do now**
1. Stop the bleeding by pressing.
2. Rinse the wound with plenty of clean water. μg: with an absorbent pad, without spreading free water.

**While waiting for communication**
- Bring the wound edges together with adhesive strips or close it per kit procedure (requires training).
- Cover with a sterile dressing and photograph it.

**Automatic monitoring:** the panel asks a wound question once a day and requests a photo: redness, swelling, fever.
**When communication returns:** photo, closure method.
**If it gets worse:** redness spreads and fever starts → C-SKIN-INFECTION.

### C-FRACTURE-OPEN · Possible fracture / dislocation · D7

**Do now**
1. Do not move the area or try to straighten it.
2. If bone is exposed, cover it with a sterile dressing without pressing.
3. Splint it in the position it is in.

**While waiting for communication**
- Cool with ice wrapped in cloth for 20 minutes.
- Pain relief: per kit procedure.

**Automatic monitoring:** question every 30 minutes on the colour, warmth and feeling of the fingers or toes beyond the splint.
**When communication returns:** photo, ultrasound image (if any), circulation checks.
**If it gets worse:** if circulation is impaired, the package goes with the highest priority.

### C-FRACTURE-SUSPECTED · Suspected fracture / crack · D7, U5

**Do now**
1. Immobilise the area with a splint or bandage.
2. Stop strenuous exercise.

**While waiting for communication**
- Apply cold and keep the area raised.
- If ultrasound is available, take images per procedure.

**Automatic monitoring:** circulation question (colour, warmth, feeling) every 4 hours (proposal).
**When communication returns:** photo, ultrasound image.
**If it gets worse:** impaired circulation → C-FRACTURE-OPEN.

### C-EYE-TRAUMA · Blow to the eye · D5

**Do now**
1. Apply cold around the eye without pressing.
2. Stop the person rubbing the eye.

**While waiting for communication**
- Test and record the vision of both eyes.
- If there is bleeding in the eye, double vision or flashes of light, protect the eye with a shield and rest it.

**Automatic monitoring:** vision test reminder every 4 hours (proposal).
**When communication returns:** vision test results, photo.
**If it gets worse:** sudden loss of vision → A-EYE.

### C-SANS · Slow change in vision, suspected SANS · U7

**Do now**
1. Test near and far vision of both eyes; record the Amsler grid.

**While waiting for communication**
- If an eye imaging device (OCT / fundus) is available, take images per procedure.
- Use plus-lens glasses for reading.

**Automatic monitoring:** the panel adds the vision and Amsler tests as a weekly periodic task.
**When communication returns:** test results, images, accompanying headache and cabin CO₂ values (added by the panel).
**If it gets worse:** if vision suddenly decreases → A-EYE.

### C-TOOTH-ABSCESS · Suspected tooth abscess · D4

**Do now**
1. Rinse the mouth with warm salt water (μg: hold it without swallowing, take it out with an absorbent cloth).
2. Measure the temperature.

**While waiting for communication**
- Mark the edge of the swelling with a pen and photograph it.
- Pain relief and antibiotics: per kit procedure (double check for antibiotics).

**Automatic monitoring:** photo of the swelling and temperature every 6 hours.
**When communication returns:** photos, temperature records, medication given.
**If it gets worse:** the swelling spreads to the eye or neck, or swallowing becomes hard → package EMERGENCY; start the antibiotic without waiting.

### C-BREATHING-SEVERE · Respiratory infection, signs of worsening · U2

**Do now**
1. Measure SpO₂, breathing rate and temperature.
2. If SpO₂ is low, give oxygen.

**While waiting for communication**
- Rest apart from the crew as far as possible; drink plenty of fluids.
- Fever reducer and antibiotics: per kit procedure.

**Automatic monitoring:** SpO₂, breathing and temperature every 4 hours; qSOFA.
**When communication returns:** reading records, course of the signs.
**If it gets worse:** SpO₂ ≤91 → oxygen, package EMERGENCY; qSOFA ≥2 → A-SEPSIS.

### C-HYPOXIA · Possible lack of oxygen · U9

**Do now**
1. Measure SpO₂ and the cabin O₂ value (the panel shows them side by side).
2. If SpO₂ is low, give oxygen.
3. Stop effort and EVA preparation.

**While waiting for communication**
- Track SpO₂ during sleep.

**Automatic monitoring:** SpO₂ continuously, including sleep; crew oxygen chart.
**When communication returns:** SpO₂ and cabin O₂ records.
**If it gets worse:** if others get the sign too → environment routing rule (A-ENVIRONMENT or C-ENVIRONMENT-CO2). SpO₂ ≤85, confusion or shortness of breath at rest → oxygen, package EMERGENCY.

### C-UTI-SEVERE · Urinary tract infection, suspected spread to the kidney · D2, D8

**Do now**
1. Measure temperature, pulse and blood pressure.
2. Start the antibiotic without waiting (per kit procedure, double check).

**While waiting for communication**
- Give plenty of fluids.
- If a urine test strip is available, test and record.

**Automatic monitoring:** temperature, pulse, blood pressure every 4 hours; qSOFA.
**When communication returns:** readings, test result, antibiotic time.
**If it gets worse:** qSOFA ≥2 (confusion, fast breathing, low blood pressure) → A-SEPSIS.

### C-KIDNEY-STONE · Suspected kidney stone · U11

**Do now**
1. Pain relief: per kit procedure.
2. Increase fluid intake.
3. Measure the temperature.

**While waiting for communication**
- Check the urine with a test strip.
- If ultrasound is available, take images per procedure.

**Automatic monitoring:** pain score every hour; temperature. The panel shows the last 7 days of water intake and urine concentration on screen.
**When communication returns:** course of the pain, test result, images, 7-day fluid summary.
**If it gets worse:** fever (Table A yellow), shivering or no urine for 12 hours → package EMERGENCY, antibiotic (per kit procedure).

### C-APPENDICITIS · Suspected appendicitis · D6

**Do now**
1. Stop food and drink by mouth.
2. Measure temperature, pulse and blood pressure.

**While waiting for communication**
- If ultrasound is available, take images per procedure.
- Pain relief and antibiotics: per kit procedure.

**Automatic monitoring:** temperature, pulse, blood pressure every hour; qSOFA.
**When communication returns:** readings, images. Ask for information for an evacuation or surgery decision.
**If it gets worse:** the pain spreads over the whole abdomen or the abdomen becomes rigid → A-ABDOMEN; qSOFA ≥2 → A-SEPSIS.

### C-SKIN-INFECTION · Suspected skin infection · U1

**Do now**
1. Mark the edge of the redness with a pen and photograph it.
2. Keep the area clean and dry; do not squeeze.

**While waiting for communication**
- Antibiotic cream or medicine: per kit procedure.

**Automatic monitoring:** the panel asks for a photo every 12 hours and asks whether the redness is past the marked edge.
**When communication returns:** photos, temperature records.
**If it gets worse:** the redness spreads beyond the mark with fever or shivering → package priority rises; qSOFA ≥2 → A-SEPSIS.

### C-SKIN-BLISTER · Blistering / painful rash · U1

**Do now**
1. Do not burst the blisters; cover with a clean, dry dressing.
2. Pay attention to hand hygiene; do not share items.

**While waiting for communication**
- Antiviral medicine: per kit procedure (starting early matters).

**Automatic monitoring:** if the rash is around the eye, vision test reminder every 12 hours.
**When communication returns:** photos, start date.
**If it gets worse:** change in vision → A-EYE.

## Instructions: MONITOR (32)

For MONITOR outcomes the package goes with the next planned communication. Instead of leaving the follow-up to the astronaut, the panel asks the questions itself at the time in the "Follow-up" line: a bad answer opens the target instruction, a good one closes the record. Follow-up times are proposals. If a new sign appears, the tree can always be opened again from the start.

| Code | Title | Do now | Then | Follow-up |
| --- | --- | --- | --- | --- |
| C-BURN-MINOR · D1 | Minor burn | (1) Cool for 20 minutes: μg wet cloth or cold pack, landing / surface cool water or wet cloth. (2) If it has blistered, do not burst it. (3) Apply burn cream and a non-stick dressing. | | After 24 h, then daily for 3 days: "Has redness or discharge increased? Is there fever?" Yes → C-SKIN-INFECTION. |
| C-HEAD-MINOR · outside the list | Minor blow to the head | (1) Apply cold to the site of the blow. | A crewmate watches the person for 24 hours. | After 2, 6 and 24 h: "Is there vomiting, a worsening headache or confusion?" Yes → C-HEAD-SEVERE. |
| C-CUT-MINOR · D1 | Minor cut / graze | (1) Rinse with clean water (μg: with an absorbent pad) and apply antiseptic. (2) Cover with a plaster. | | After 24 h, then daily: "Is redness or swelling spreading?" Yes → C-SKIN-INFECTION. |
| C-STRAIN · U5, D1 | Muscle / joint strain | (1) Rest the area; stop the exercise that hurts. (2) Apply cold for 20 minutes. | Repeat the cold for the first 48 h; support with an elastic bandage; simple pain relief if needed. | After 48 and 72 h: "Has the pain eased? Is there pain at one point on the bone?" If not eased, or pain at one point → C-FRACTURE-SUSPECTED. |
| C-LENS · D5 | Contact-lens-related eye irritation | (1) Remove the lens at once. (2) Rinse with artificial tears. | Wear glasses until healed. | After 24 h: "Do redness or stinging continue? Has vision decreased?" If they continue → antibiotic drops (per kit procedure); if vision decreased → A-EYE. |
| C-EYE-FOREIGN-BODY · D5 | Particle in the eye | (1) Do not rub the eye. (2) Rinse with the eyewash kit (μg: with the closed head). | | After 24 h: "Has the stinging gone?" No → C-EYE-GENERAL. |
| C-EYE-IRRITATION · D5 | Eye irritation | (1) Use artificial tears. (2) Take a break from screens. | Check cabin humidity and airflow (the panel shows the humidity). | After 24 h: "Has the irritation gone?" No → C-EYE-GENERAL. |
| C-EYE-GENERAL · D5, U7 | Unclear eye complaint | (1) Test and record the vision of both eyes. | | Repeat the vision test after 24 h: "Has the result changed?" Loss of 1 line → C-SANS; sudden loss → A-EYE. |
| C-TOOTH-FRACTURE · D4 | Broken tooth / lost filling | (1) Rinse the mouth with clean water. (2) Apply the temporary filling from the dental kit (requires training). | | After 24 h: "Is there pain or swelling?" Yes → DS1 (tooth branch). |
| C-TOOTH-PAIN · D4 | Toothache | (1) Rinse the mouth with warm water, use dental floss. (2) Simple pain relief if needed. | | After 24 h: "Is there swelling or fever?" Yes → DS1. |
| C-BREATHING · U2 | Upper respiratory infection | (1) Rest, drink plenty of fluids. (2) Pay attention to hand hygiene, use a mask. | | Temperature read automatically twice a day; every 12 h: "Is there shortness of breath?" Shortness of breath or fever longer than 3 days → C-BREATHING-SEVERE. |
| C-ALLERGY-MILD · D3 | Mild allergic reaction | (1) Stop and note the suspected trigger. (2) Allergy medicine: per kit procedure. | | After 1, 2 and 4 h: "Is there swelling of the lips or tongue, or shortness of breath?" Yes → A-ANAPHYLAXIS at once. |
| C-CONGESTION · U3 | Head-face fullness (fluid shift to the head) | (1) Use a decongestant nasal spray for a short time. | Check cabin humidity and CO₂ (the panel shows them). Exercise helps redistribute fluid. | After 24 h: "Has vision become blurred?" Yes → C-SANS. |
| C-CO2 · U10 | CO₂-related headache (one person) | (1) Move to a well-ventilated area. (2) Check the cabin CO₂ value (the panel records it). | Drink fluids, take a break; simple pain relief if needed; check the CO₂ removal system per procedure. | After 1 h: "Has the headache gone?" The panel also watches the others' symptom records. If it starts in someone else → environment routing rule; nausea, confusion or fast breathing → A-ENVIRONMENT. |
| C-HEADACHE · U10 | Headache | (1) Drink fluids, rest. (2) Simple pain relief if needed. | Record the severity (1–10) and duration of the pain. | After 4 h: "Did the pain become sudden and very severe? Has speech become disturbed?" Yes → A-BRAIN. |
| C-DERMATITIS · U1 | Skin rash / dryness | (1) Clean and dry the area. (2) Apply moisturiser or the cream from the kit. | Check rubbing clothing or a sensor strap; photograph it. | After 48 h: "Is the rash spreading, warm or swollen?" Yes → C-SKIN-INFECTION. |
| C-UTI · D2 | Suspected urinary tract infection | (1) Drink plenty of fluids. (2) If a urine test strip is available, test. | Antibiotic: per kit procedure. | After 12 h: "Has fever or lower-back pain started?" Yes → C-UTI-SEVERE. |
| C-CONSTIPATION · U4 | Constipation | (1) Take fluids and high-fibre food. (2) Stool softener: per kit procedure. | | After 24 h: "Is there vomiting, or is no gas passing?" Yes → A-ABDOMEN. |
| C-ADAPTATION · U4 | Space adaptation syndrome (motion sickness) | (1) Keep the head still, avoid sudden movement. (2) Anti-nausea medicine: per kit procedure. | If vomiting, replace lost fluids. It usually passes in a few days. | Daily for 3 days: "Does the vomiting continue? Can you keep fluids down?" If unable to take fluids, the package goes in the first communication window. |
| C-ABDOMEN-GENERAL · U4, D6 | Abdominal discomfort | (1) Eat light food, take fluids. (2) Measure the temperature. | | After 4–6 h: "Has the pain settled in one spot? Is there fever or vomiting?" Settled in the lower right → C-APPENDICITIS; other yes answers → abdomen branch (K1) again. |
| C-BACK · U4 | Space-related lower-back pain | (1) Rest with the knees pulled to the chest. (2) Simple pain relief if needed. | Do stretching exercises. | After 72 h: "Is there pain or numbness spreading to the leg?" Yes → C-NERVE. |
| C-NERVE · U5 | Suspected trapped nerve | (1) Avoid movements that hurt. (2) Simple pain relief if needed. | | Daily: "Has arm or leg strength decreased? Has bladder or bowel control changed?" Yes → package goes with EMERGENCY priority. |
| C-MUSCLE-GENERAL · U5 | Musculoskeletal pain | (1) Rest; apply heat or cold. | | After 72 h: "Has the pain eased?" No → musculoskeletal branch (KS1) again. |
| C-EVA-HAND · U8 | EVA-glove-related hand / nail problem | (1) Photograph the hands and nails. (2) Do not pull off a lifted nail; protect it with tape. | Dress rub wounds. | After 4 h: "Has the numbness eased? Is there joint pain or weakness?" If the numbness has spread, or joint pain or weakness started → A-DCS. |
| C-FEVER · U2, D8 | Feverish illness | (1) Measure the temperature, drink fluids, rest. (2) Fever reducer: per kit procedure. | Look for a source: cough, urine, wound, teeth. | Temperature read automatically every 4 h and qSOFA calculated; every 4 h: "Is there confusion or fast breathing?" Yes or qSOFA ≥2 → A-SEPSIS. |
| C-PALPITATIONS · D9 | Palpitations | (1) Secure yourself, breathe slowly and deeply. (2) Take an ECG recording. | Note triggers such as caffeine, lack of sleep, stress. | ECG monitored continuously; ECG red → A-RHYTHM automatically. After 24 h: "Was there chest pain or a feeling of fainting?" Yes → A-HEART or A-RHYTHM. |
| C-FATIGUE · U6, U9 | General weakness | (1) Measure pulse, SpO₂, temperature and blood pressure. | Adjust fluids, nutrition and sleep; lighten the workload. | After 24 h: "Has it got worse?" Yes, or any reading yellow → the tree opens again from the start. |
| C-PANIC · U6 | Panic / anxiety attack | (1) Move to a quiet area; a crewmate stays nearby. (2) Breathe in for 4 seconds, hold for 4, breathe out over 6. | Take an ECG recording to make sure it is not cardiac. | After 24 h: "Did the attack come back?" At the third attack → C-STRESS and a request for psychological support in the first communication. |
| C-SLEEP · U6 | Sleep disorder | (1) Fix sleep times. (2) Reduce light and noise in the sleep area. | No caffeine in the afternoon. Sleep medicine: per kit procedure. | Actigraphy records sleep duration automatically for 7 days. If the 7-day mean is under 6 hours, a red gate opens on the mission readiness card and the package goes in the first window. |
| C-LOW-MOOD · U6 | Low / depressed mood | (1) Keep the daily routine and exercise. (2) Spend time with crewmates. | Ask for a psychological support call in the first communication. | Day 3 and day 7: "Are there thoughts of self-harm?" Yes → A-PSYCH at once. |
| C-STRESS · U6 | Stress | (1) Review the workload with the crew lead. (2) Set aside time for rest and exercise. | Ask for a psychological support call if wanted. | After 7 days: "Has it got worse?" Yes → sleep-mood branch (PS1) again. |
| C-UNCLEAR · outside the list | Not classified, general monitoring | (1) Measure pulse, SpO₂, temperature and blood pressure. (2) Write the complaint into the panel in your own words. | | After 4–6 h the panel opens the tree again from the start. |

### Add-on: C-RAD-MONITOR · Radiation warning, no signs · U12

If the RAD flag is set and the outcome is not A-RAD, these steps are added to the end of every outcome.

- Stay in the shielded area while the warning lasts.
- Record the dosimeter values (the panel records them itself).
- Watch for nausea, vomiting and skin redness for 48 hours; the panel asks every 12 hours.
- If a sign starts, write down the time; the panel opens A-RAD.
- **When communication returns:** dose values, duration of the warning.

## Kit stock, double check and CMO patient mode

Medication and dose decisions are left to the mission medical kit procedure and the CMO; the panel does not write doses. The panel does three things: it links each kit item to the medication record and the stock, it asks for a second person's confirmation for critical drugs, and it simplifies the instruction when the patient is the CMO.

### Kit items

| Kit item | Used by | Double check | Stock alert |
| --- | --- | --- | --- |
| Adrenaline auto-injector | A-ANAPHYLAXIS | Yes (2nd dose) | Fewer than 2 doses left |
| Aspirin | A-HEART | Yes (allergy record is read) | — |
| Antibiotic (oral / intravenous) | A-SEPSIS, A-ABDOMEN, C-UTI-SEVERE, C-UTI, C-APPENDICITIS, C-TOOTH-ABSCESS, C-BREATHING-SEVERE, C-SKIN-INFECTION, C-LENS (drops) | Yes (starting) | Not enough for a full course |
| Glucose / glucagon | A-CONSCIOUSNESS, A-BRAIN, C-FAINTING, C-HEAD-SEVERE, A-HEAT | Yes for glucagon | — |
| Intravenous fluid | A-SEPSIS, A-HEAT, A-BLEEDING | Yes | Volume left |
| Pain relief | Many | Yes for strong pain relief | The same pain reliever for more than 3 days (periodic tasks table) |
| Allergy medicine, anti-nausea medicine, antiviral, stool softener, decongestant | The related instructions | No | Below 25 % |
| Sleep medicine | C-SLEEP | No | Use on ≥3 nights a week (periodic tasks table) |
| Oxygen (mask, 100 %) | A-ENVIRONMENT, A-CONSCIOUSNESS, A-ANAPHYLAXIS, A-DCS, A-HEART, C-HYPOXIA, C-BREATHING-SEVERE | — | Time left (minutes) |
| AED and pads | A-CPR, A-HEART, A-RHYTHM | — | Battery, pads |
| i-STAT CHEM8+ cartridge | Blood glucose steps | — | Number of cartridges |
| Tourniquet, eyewash kit, urine test strip, temporary filling, ultrasound, suction | The related instructions | — | Warning next to the step if missing |

### Rules

- A medication step appears on the instruction card with the drug name, the dose reference from the kit card, the amount left and the expiry date. Example: "Adrenaline auto-injector: 1 left. No spare if a 2nd dose is needed."
- Pressing ✓ Done lowers the stock and enters the drug in the medication record on the Personal screen.
- If the expiry date has passed, a red warning appears; the CMO decides whether to use it, and this is stated in the package.
- **Double check:** a second crew member reads the drug name, the dose on the kit card and the patient's allergy record on screen and confirms; both identities are recorded. If there is no second person, "single-person confirmation" is recorded and flagged in the package.

### CMO patient mode

**When it starts:** if the person chosen at G2 is the CMO, or the CMO opening the panel chooses "Myself". The mission settings file holds the CMO, the backup CMO and each person's training (CPR, intravenous access, wound closure, ultrasound, dental filling).

While the mode is on:
- Instructions are shown for the backup CMO.
- Steps that need training (intravenous access, wound closure, ultrasound, temporary filling) carry the label "Training required: [backup CMO] can do this; otherwise skip and note it in the package".
- All medication steps require a double check.
- If the CMO is conscious, the step "Consult the CMO aloud at decision steps" is added to the Do now list.
- The package priority rises one level; MONITOR packages also go in the first window.

## SBAR communication package

The "When communication returns" information is not compiled by hand: from the tree's answers, the step records and the sensor trends the panel builds a package in SBAR format (Situation, Background, Assessment, Recommendation) and puts it in the LOS queue. The "When communication returns" line of each instruction sets the package's required fields.

| Field | Content |
| --- | --- |
| S · Situation | Outcome code and level, patient(s), start time, current course (improving / stable / worsening) |
| B · Background | Mission day, environment code, G1 selections, context of the last 24 hours (EVA, radiation), related personal records (medication, allergy, last i-STAT), answer path and which answers were pre-filled and confirmed |
| A · Assessment | Sensor trends (2 hours before the event versus now; lowest and highest values), triggered "If it gets worse" rules, G-TRANSIT summary (if any) |
| R · Recommendation / request | Steps done (step, time, who), steps not done and why, medication given and who double-checked it, stock state, decisions asked of Earth (evacuation, surgery, medication approval), open questions from "Not sure" answers |
| Attachments | Photo, ECG strip, ultrasound image, raw sensor file; sent separately from the text and at lower priority |

### Sending rules

- EMERGENCY and PRIORITY packages go in the first communication window; MONITOR packages go with the daily summary in the next planned communication (in the first window in CMO patient mode).
- In a window, text summaries go first (up to about 4 KB per package, proposal), then attachments.
- Later packages for the same event carry only what changed; packages of people affected by the same event are linked.
- With no link the package enters the `PriorityAlertQueue`; the screen shows a badge "Earth notification queued (n)".
- Earth's reply arrives linked to the package and is added to the instruction card as an "Earth note". A red alarm is closed only with the flight surgeon's approval.

### Example package (Day 142, gradual CO₂ rise)

```text
[PRIORITY] C-ENVIRONMENT-CO2 · Day 142 17:05 · Patient: A1, A3 · Course: improving
S: Cabin CO₂ rose gradually; headache in two people (severity 4 and 5).
   Consciousness normal, SpO₂ above 91.
B: Microgravity. No EVA and no radiation warning in the last 24 h.
   G1: "Same sign in more than one person" (pre-selected: A1 16:10,
   A3 16:12; A2 confirmed) → C-ENVIRONMENT-CO2 (CO₂ below the emergency limit).
   G2: A3 chosen (lowest SpO₂); linked package for A1 sent separately.
A: CO₂ 1-h mean 2.3 (14:00) → 3.4 mmHg (17:00), peak 3.6.
   SpO₂ A1 97 → 95, A3 96 → 93. Cognition A3: attention z = −1.1.
R: 17:07 module change ✓ (A2) · 17:09 fan ✓ (A2) · 17:15 backup CO₂
   removal on ✓ (A1) · 17:20 effort stopped ✓.
   Medication: pain relief (kit), A3, 17:25, double check A2 + A1.
   Request: CDRA fault analysis; approval to postpone A3's EVA tomorrow.
   Open questions: none.
Attachments (2nd priority): CO₂ curve (CSV), 2 Cognition reports.
```

## Decision tree JSON schema (version 0.3)

The fields `text`, `type`, `yes`, `no`, `cond`, `sensor`, `now`, `wait`, `comm` and `worse` of version 0.2 are kept. Selection screens are defined with `type: "select"`; plain-text steps become objects. Thresholds are not in the code but in the thresholds file; the crew list and training are read from the mission settings file. (In this repository: `src/config/thresholds.json`, `src/config/mission.json` and `src/config/acute*.json`.)

```json
{
  "version": "0.3",
  "start": "G1",
  "screens": {
    "G1": {
      "type": "select", "multi": true,
      "text": "Is there a safety problem in the environment? Select any that apply, or press 'No problem'.",
      "options": [
        {"text": "Smoke, burning smell or fire alarm", "goto": "A-ENVIRONMENT", "prefill": "alarm.fire_1h"},
        {"text": "Pressure drop or leak alarm", "goto": "A-ENVIRONMENT", "prefill": "alarm.pressure_1h"},
        {"text": "Toxic gas, chemical smell or leak", "goto": "A-ENVIRONMENT", "prefill": "alarm.toxic_1h"},
        {"text": "Headache, dizziness or shortness of breath in more than one person at the same time", "goto": "@route_environment", "prefill": "count_crew(headache|dizzy|dyspnea, 6h) >= 2"},
        {"text": "Cabin O₂ or CO₂ alarm", "goto": "@route_environment", "prefill": "cabin.o2 == 'red' || cabin.co2_1h == 'red'"}
      ],
      "none": {"text": "No problem", "goto": "G2"},
      "unsure": {"action": "show_cabin_live", "if_red": "A-ENVIRONMENT", "else": "G2", "note": "environment could not be checked"},
      "after_outcome": "G2"
    },
    "G2": {
      "type": "select",
      "text": "Who did you open this panel for?",
      "options_from": "mission_settings.crew",
      "self": {"text": "Myself", "goto": "S4"},
      "other": {"goto": "G3", "load": ["sensors", "meds", "allergies"], "cmo_mode_if": "selected.role == 'CMO'"},
      "unsure": {"suggest": "worst_vitals", "goto": "G3"},
      "prefill": "alarm.crew_id"
    },
    "G3": {
      "type": "select",
      "text": "Tap the shoulder and call out loudly. Watch the chest rise and fall for 10 seconds. Which is it?",
      "options": [
        {"text": "Responds when called", "goto": "S4"},
        {"text": "Does not respond, breathing normally", "goto": "A-CONSCIOUSNESS"},
        {"text": "Does not respond; not breathing or breathing abnormally", "goto": "A-CPR"}
      ],
      "unsure": {"action": "repeat_10s", "then": "A-CPR"},
      "show": ["spo2", "hr", "resp_rate"]
    },
    "S4": {
      "type": "select", "multi": true,
      "text": "Is any of these present?",
      "options": [
        {"text": "Bleeding that will not stop", "goto": "A-BLEEDING", "priority": 2},
        {"text": "Feeling about to faint", "goto": "T4a", "priority": 4},
        {"text": "Overheating and confusion", "goto": "A-HEAT", "priority": 6}
      ],
      "other": {"text": "Something else / not sure", "goto": "T1"},
      "none": {"text": "None of these", "goto": "X1"}
    }
  },
  "questions": {
    "R1c": {"text": "Has the fever lasted longer than 3 days?", "cond": "answer.R1 == 'yes'",
            "yes": "C-BREATHING-SEVERE", "no": "C-BREATHING", "unsure": "yes"}
  },
  "routes": {
    "@route_environment": [
      {"if": "cabin.ppo2 == 'red' || cabin.p == 'red' || cabin.co2_1h >= th.co2_emergency || any_affected_spo2 <= 91 || loc_change || !sensors_ok", "goto": "A-ENVIRONMENT"},
      {"else": "C-ENVIRONMENT-CO2"}
    ]
  },
  "outcomes": {
    "C-FAINTING": {
      "level": "PRIORITY",
      "now": [
        {"id": "n1", "text": "Secure the person; measure pulse, blood pressure, ECG", "auto_read": ["hr", "bp", "ecg"]},
        {"id": "n2", "text": "Measure blood glucose", "kit": "istat_chem8"},
        {"id": "n3", "env": ["landing", "surface"], "text": "Lie down, legs up", "link": "gtransit"},
        {"id": "n4", "env": ["ug"], "text": "If ECG and glucose are normal, ask about fluids, sleep and medication"},
        {"id": "n5", "env": ["suit"], "text": "Sit or lie down, partner comes over, end the EVA"}
      ],
      "wait": [{"text": "Blood pressure and pulse", "timer_min": 15, "auto_read": ["bp", "hr"]}],
      "worse": [
        {"if": "ecg.irregular || hr < 40 || hr > 150", "goto": "A-RHYTHM"},
        {"if": "gtransit.ori >= 80 || gtransit.margin < 5 || loc_lost", "goto": "A-CONSCIOUSNESS"},
        {"if": "glucose < 55", "action": "step:glucose", "comm_priority": "EMERGENCY"}
      ],
      "comm": {"format": "SBAR", "window": "first", "required": ["vitals", "time", "intake", "glucose", "gtransit"]},
      "sources": []
    },
    "C-ALLERGY-MILD": {
      "level": "MONITOR",
      "followup": {"at_h": [1, 2, 4], "questions": ["Is there swelling of the lips or tongue, or shortness of breath?"], "escalate": "A-ANAPHYLAXIS"}
    }
  },
  "addons": {"RAD": "C-RAD-MONITOR"},
  "step_fields": ["id", "text", "env", "role", "kit", "double_check", "training", "timer_min", "auto_read", "link"]
}
```

The `training` field of a step sets which steps are labelled in CMO patient mode; the `double_check` field sets which drugs need a second person's confirmation. The `sources` field is filled with the basis of each instruction after physician approval.

## Scope, validation and physician approval

All 22 conditions are linked to at least one instruction and no branch is left without an outcome; this check runs automatically on the decision tree JSON. In version 3 the tree is also tested with case scenarios.

### Coverage

| Code | Condition | Outcomes |
| --- | --- | --- |
| U1 | Skin rash / dermatitis | C-SKIN-INFECTION, C-SKIN-BLISTER, C-DERMATITIS |
| U2 | Upper respiratory symptoms (infection) | C-BREATHING-SEVERE, C-BREATHING, C-FEVER |
| U3 | Head-face congestion / sinus pressure | C-CONGESTION |
| U4 | Space adaptation syndrome, back pain, constipation | C-CONSTIPATION, C-ADAPTATION, C-ABDOMEN-GENERAL, C-BACK |
| U5 | Musculoskeletal injury / minor trauma | C-FRACTURE-SUSPECTED, C-STRAIN, C-NERVE, C-MUSCLE-GENERAL |
| U6 | Sleep disorder, anxiety, depression | A-PSYCH, C-FATIGUE, C-PANIC, C-SLEEP, C-LOW-MOOD, C-STRESS |
| U7 | Vision change (SANS) | A-EYE, C-SANS, C-EYE-GENERAL |
| U8 | EVA-related: DCS, paraesthesia, nail separation | A-DCS, C-EVA-HAND |
| U9 | Hypoxia / acute mountain sickness | A-ENVIRONMENT, A-CONSCIOUSNESS, C-HYPOXIA, C-FATIGUE |
| U10 | Headache (CO₂-related) | A-ENVIRONMENT, C-ENVIRONMENT-CO2, C-CO2, C-HEADACHE |
| U11 | Kidney stone | C-KIDNEY-STONE |
| U12 | Acute radiation exposure | A-RAD, C-RAD-MONITOR |
| U13 | Cabin atmosphere / toxic exposure, fire | A-ENVIRONMENT, C-ENVIRONMENT-CO2, A-CONSCIOUSNESS |
| D1 | Minor trauma, cut, burn | A-BLEEDING, C-BURN-SEVERE, C-CUT-DEEP, C-BURN-MINOR, C-CUT-MINOR, C-STRAIN |
| D2 | Urinary tract infection | A-SEPSIS, C-UTI-SEVERE, C-UTI |
| D3 | Allergic reaction / anaphylaxis | A-CONSCIOUSNESS, A-ANAPHYLAXIS, C-ALLERGY-MILD |
| D4 | Toothache / abscess | C-TOOTH-ABSCESS, C-TOOTH-FRACTURE, C-TOOTH-PAIN |
| D5 | Eye injury / lens problems | A-EYE, C-EYE-TRAUMA, C-LENS, C-EYE-FOREIGN-BODY, C-EYE-IRRITATION, C-EYE-GENERAL |
| D6 | Acute abdomen | A-ABDOMEN, C-APPENDICITIS, C-ABDOMEN-GENERAL |
| D7 | Fracture | A-BLEEDING, C-FRACTURE-OPEN, C-FRACTURE-SUSPECTED |
| D8 | Sepsis | A-CONSCIOUSNESS, A-SEPSIS, C-UTI-SEVERE, C-FEVER |
| D9 | Heart attack / arrhythmia | A-CPR, A-CONSCIOUSNESS, A-HEART, A-RHYTHM, C-FAINTING, C-PALPITATIONS |
| Outside the list | Safety nets | A-BRAIN, A-HEAT, C-HEAD-SEVERE, C-HEAD-MINOR, C-UNCLEAR |

### Validation cases

Criteria: under-triage (an EMERGENCY case falling to a lower level) must be 0; the over-triage rate is reported; the mean number of questions without a red flag should be 10 or fewer; every outcome appears in at least one case. The 17 cases below cover the paths changed in version 3; the full set contains each of the 64 outcomes.

| # | Case | Expected outcome | Rule tested |
| --- | --- | --- | --- |
| 1 | Smoke alarm in a module | Option pre-selected at G1 → A-ENVIRONMENT → G2 | G1 selection screen |
| 2 | No problem in the environment, the person opens it for themselves | G1 "No problem" → G2 "Myself" → S4; G3 not shown | G1 pass-through, G2 |
| 3 | A2 opens it for A1, who is conscious | A1 chosen at G2, A1's sensors loaded → G3 "responds" → S4 | Choosing the person |
| 4 | The CMO (A2) is the patient, deep cut | A2 at G2 → CMO patient mode → C-CUT-DEEP; wound closure labelled "training required"; package in the first window | CMO patient mode |
| 5 | Headache in two people, CO₂ 1-h mean 3.4 mmHg, SpO₂ normal | C-ENVIRONMENT-CO2 | Environment routing rule |
| 6 | Headache in two people, CO₂ 1-h mean 4.6 mmHg | A-ENVIRONMENT | Environment routing rule |
| 7 | "Not sure" at G1, cabin values green | G2, note "environment could not be checked" in the package | G1 Not sure |
| 8 | Opened for someone else, the person does not respond, breathing is gasping and irregular | A-CPR | G3 |
| 9 | "Not sure" twice at G3 | A-CPR | G3 Not sure |
| 10 | Headache in one person, poorly ventilated area | C-CO2 | Removal of H1 |
| 11 | Clouded consciousness, blood glucose 48 mg/dL | A-CONSCIOUSNESS and the glucose step | Blood glucose step |
| 12 | Slurred speech | S4 label → A-BRAIN | S4 direct jump |
| 13 | Feeling faint after the Mars landing, ECG normal | C-FAINTING, landing steps, G-TRANSIT opens | Environment code |
| 14 | Feeling faint in microgravity; the person says "my heart is regular", ECG shows a 4 s pause | A-RHYTHM | Conflict rule |
| 15 | Anaphylaxis, systolic 86 at 15 minutes, adrenaline stock 1 | Second-dose alert, "last dose" note, double check | Trigger and kit stock |
| 16 | Mild allergy; lip swelling at the 2-hour follow-up | A-ANAPHYLAXIS | MONITOR follow-up |
| 17 | Core temperature 40.2 °C after exercise, confusion | Sensor-triggered opening → A-HEAT | New outcome |

### Points awaiting physician approval

- Matching the medication decisions (antibiotic, aspirin, second adrenaline dose, glucagon) to the mission rules on what may be given without Earth's approval
- Safety nets outside the list (stroke, head injury, heat stroke) and the C-FAINTING outcome
- Monitoring intervals (5 and 15 minutes, 4 hours, etc.) and MONITOR follow-up times
- Matching the CPR, repressurisation and oxygen steps in microgravity to the mission procedures
- The wording of the G1 safety options and the G3 consciousness screen
- The CO₂ emergency limit between A-ENVIRONMENT and C-ENVIRONMENT-CO2 (proposal 4.0 mmHg, 1-hour mean)
- The A-HEAT cooling target (38.5 °C) and entry thresholds
- Blood glucose thresholds (70 and 55 mg/dL)
- Microgravity and spacesuit step variants
- The directions of "Not sure" answers
- Sensor triggers: shock (pulse >120 and systolic ≤90), tourniquet time, second adrenaline dose alert, use of qSOFA
- The list of steps needing training in CMO patient mode
