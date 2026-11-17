# Legal, Terms-of-Service and Enforcement Limits on Automating IRCTC Ticket Search and Booking (India, as of November 2026)

Scope note: background research, not legal advice. "Read directly" means I extracted and read the primary document this session; "snippet only" means the claim comes from a search-result summary and the page itself was not opened (or blocked), so treat it as lower confidence.

Three tiers used throughout:
- (a) read-only availability search / alerts
- (b) user-side form autofill, human does login, CAPTCHA, OTP, payment
- (c) full booking automation / CAPTCHA bypass / multiple accounts

---

## 1. Railways Act 1989, Section 143 — text, penalties, judicial interpretation, and whether it reaches self/family booking

### Takeaway
Section 143 criminalises *carrying on the business* of procuring and supplying tickets by anyone who is not a railway servant or authorised agent (up to 3 years and/or Rs 10,000 fine, with a default minimum of one month or Rs 5,000, plus forfeiture of tickets, and abetment punished equally). The Supreme Court (9 Jan 2025) held it covers e-tickets and unauthorised persons using many user IDs, but that creating multiple IDs is not itself an offence under s.143 and that breaches of IRCTC's contractual terms are a civil matter; nothing I found applies s.143 to a person booking only their own/family travel with no "business", though no court has squarely ruled on that either.

### Cited Findings
- Text of s.143 as reproduced by the Supreme Court (read directly): "(1) if any person, not being a railway servant or an agent authorised in this behalf,— (a) carries on the business of procuring and supplying tickets for travel on a railway or from reserved accommodation for journey in a train; or (b) purchases or sells or attempts to purchase or sell tickets with a view to carrying on any such business either by himself or by any other person, he shall be punishable with imprisonment for a term which may extend to three years or with fine which may extend to ten thousand rupees, or with both, and shall also forfeit the tickets…"; proviso: absent special reasons, not less than one month's imprisonment or Rs 5,000 fine; "(2) Whoever abets any offence punishable under this section shall, whether or not such offence is committed, be punishable with the same punishment" — [Supreme Court judgment PDF, para 16](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf)
- Case: Inspector, Railway Protection Force, Kottayam v. Mathew K. Cherian & Anr. (with J. Ramesh v. Union of India), decided 9 January 2025, Justices Dipankar Datta and Prashant Kumar Mishra; neutral citation 2025 INSC 51 — [Supreme Court judgment PDF](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf); [Verdictum](https://www.verdictum.in/court-updates/supreme-court/inspector-railway-protection-force-kottayam-v-mathew-k-cherian-2025-insc-51-section-143-railways-act-illegal-sale-of-e-tickets-1564397)
- Facts (Mathew): not an authorised agent; alleged to have created "hundreds" of fake IRCTC user IDs to sell tickets at a premium; Kerala HC had quashed the case on the reasoning that the Act predates e-ticketing. The SC called that reasoning "plainly erroneous" and restored the prosecution — [SC judgment, paras 5, 7(III), 19-20, 38](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf)
- Holding on e-tickets: s.143 "criminalises unauthorised procurement and supply, irrespective of the mode of procurement and supply" and "makes no distinction between physical and online sale of tickets" — [SC judgment, paras 27-28](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf)
- Holding on "procure and supply": it is no defence that tickets were issued by IRCTC in the passengers' own names. "Taking active steps, however faithfully, in order to acquire and provide tickets to third parties but without being a railway servant or an authorised agent would attract the expression 'procure and supply'" — [SC judgment, para 30](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf)
- Holding on multiple IDs: "Section 143 does not criminalise creating multiple user IDs. Penal provisions have to be read strictly and narrowly… Any breach has to be remedied by civil action and not criminal action." An authorised agent (Ramesh) "cannot be proceeded against under Section 143 … for alleged breach of any of the terms and conditions of the contract" — [SC judgment, paras 35-37](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf)
- The SC noted IRCTC's personal-ID cap as "12 per month (24 per month with a user ID which is Aadhaar verified)" and that the PSP/RSP rules "strictly prohibit using personal/fraudulent IDs to book tickets for commercial purposes" — [SC judgment, paras 18-19](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf)
- The SC's observations were expressly for deciding the quashing appeal and "may not be construed as an expression of opinion on the merits of the prosecution's case" against Mathew — [SC judgment, para 39](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf)
- Later ruling (read directly): Madhya Pradesh High Court, Avinash Kumar Soni v. Railway Protection Force, MCRC-9527-2023, order dated 11 August 2026 (Justice Himanshu Joshi), 2026:MPHC-JBP:62840. An authorised IRCTC agent was charge-sheeted under s.143 because two Tatkal tickets were booked through his *personal* user ID instead of his agent ID. Proceedings quashed, following Mathew K. Cherian paras 17 and 35-37: using a personal ID contrary to IRCTC conditions "may invite appropriate administrative or contractual action… but such alleged breach by itself cannot attract criminal liability under Section 143" — [MP High Court order via LiveLaw](https://www.livelaw.in/pdf_upload/2026/08/24/avinash-kumar-soni-v-railway-protection-force-695873.pdf)
- That MP HC order shows how RPF cases arise in practice: prior information, a raid on a cyber cafe, seizure of computer, printer and dongle, prosecution over as few as two tickets, and roughly six years of pendency (2019 raid, 2026 quashing) — [MP High Court order](https://www.livelaw.in/pdf_upload/2026/08/24/avinash-kumar-soni-v-railway-protection-force-695873.pdf)
- IRCTC's own 2020 position stretches s.143 further than the SC text: "under Section 143(2) of Railway Act- carrying of unauthorized business of procuring and supplying railway tickets is illegal. Use of an application to fraudulently help few to jump the queue is illegal too and falls within the same ambit of illegality" — [IRCTC press release, 2 Nov 2020](https://www.irctc.com/assets/images/pressrelease/IIT_Press_release.pdf)

### Inferences
- The statutory trigger is "carries on the business" (or buying/selling "with a view to carrying on any such business"). A person buying tickets on their single account for their own or family's travel is not, on the plain words, carrying on a business of procuring and supplying. The SC's strict-construction language (para 36) supports reading the section narrowly. This is an inference from the text; I found no judgment that states it as a holding.
- Risk factors that move a person toward s.143: supplying tickets to third parties (para 30 says acting "however faithfully" for third parties counts if done as a business), taking any fee or commission, repeat/volume booking for non-family, and many user IDs used as the means of doing so. The many IDs are evidence of the business, not the offence itself.
- Section 143(2) abetment is the hook used against tool makers (see Q2): a developer who distributes or sells a booking tool to others can be charged as abetting touts even if he books nothing himself. A purely personal, undistributed tool has no one to abet.
- "Not criminal under s.143" does not mean "permitted": the SC and MP HC both point to civil/administrative consequences (ID deactivation, ticket cancellation), which is exactly what IRCTC's terms provide (Q3).

### Gaps
- No reported decision found that squarely considers a non-commercial individual using automation for own/family bookings. The position is inferred, not adjudicated.
- Whether "business" requires profit, or repetition alone suffices, was not analysed in the SC judgment; I did not find a High Court decision defining it. The Karnataka HC matter surfaced in search (petitioner arguing he "neither procured nor distributed" tickets) was not read.
- Outcome of the restored trial against Mathew K. Cherian is unknown.
- I did not fetch the indiacode.nic.in text of s.143 directly; the text above is as reproduced by the Supreme Court.

---

## 2. IT Act 2000 (ss.43, 66) and RPF operations against illegal Tatkal software — who gets prosecuted

### Takeaway
Reported enforcement is overwhelmingly against developers, sellers/"panel" operators, and touts/agents who use the software commercially, charged mainly under Railways Act s.143 (and s.143(2) abetment); IT Act sections appear in some FIRs but I could not verify section-by-section usage. I found no reported prosecution of an ordinary passenger for using a tool on their own account for their own travel, but the one well-documented case of a solo developer (Super Tatkal, 2020) shows that distributing a paid speed-up app is enough to be arrested.

### Cited Findings
- Super Tatkal / Super Tatkal Pro (Oct-Nov 2020): developer S. Yuvarajaa, an IIT Kharagpur alumnus, arrested by RPF in Tamil Nadu; case under s.143(2) Railways Act; Southern Railway said he made about Rs 20 lakh from the apps between 2016 and 2020; app pulled from Play Store. His stated defence: he only enabled users' own bookings and was not a ticketing agent. An RPF official said his error was not getting IRCTC's permission — [The News Minute](https://thenewsminute.com/article/ready-help-irctc-improve-booking-system-says-tn-techie-arrested-making-app-138513); [Inc42](https://inc42.com/buzz/iit-grads-faster-rail-ticket-booking-app-puts-him-behind-bars); [RailPost](https://www.railpost.in/?p=14055)
- IRCTC's official response to that case (read directly): features in the app "were disabled to ensure level playing field"; the site is for booking "in normal way without aid of any illegal software"; counter-measures include "setting up of time limits for booking of e-tickets… and introduction of several captchas"; "user ids are de-activated daily of suspicious users"; the app "is not free" and the accused "earned money… charging from those who could afford to pay" — [IRCTC press release, 2 Nov 2020](https://www.irctc.com/assets/images/pressrelease/IIT_Press_release.pdf)
- Real Mango (Aug-Sep 2020): RPF traced the software on 9 Aug 2020; arrested developer/admin Chandra Gupta, network head Subhendu Biswas ("Mango Sir"), business manager Rahul Roy, plus sellers and touts; about 50 arrests reported; software described as bypassing CAPTCHA; live tickets worth over Rs 5 lakh blocked — [ETV Bharat](https://etvbharat.com/english/bharat/bharat-news/rpf-decimates-illegal-software-real-mango-arrests-50-touts/na20200908201454798); [Deccan Herald](https://www.deccanherald.com/india/rpf-disrupts-software-used-for-cornering-confirmed-railway-tickets-884475.html); [Drishti IAS summary](https://www.drishtiias.com/daily-updates/daily-news-analysis/real-mango-an-illegal-software/print_manually)
- 2019-20 nationwide crackdown (ANMS, MAC, Jaguar and related): RPF DG said the operation included arrest of the developer of "MAC"; about 100 "panel developers and software sellers" arrested; a Parliament reply recorded 82 accused arrested till 25.02.2020 in ANMS cases — [Tribune](https://www.tribuneindia.com/news/nation/railways-roots-out-illegal-software-more-tatkal-tickets-for-passengers-now-43526/amp); [Onmanorama](https://www.onmanorama.com/news/india/2020/02/18/indian-railways-tatkal-ticket-illegal-software.html); [Lok Sabha answer AS184 (not opened; snippet only)](https://eparlib.nic.in/bitstream/123456789/974951/1/AS184.pdf)
- "Fusion" software: RPF arrested Shamsher Alam (Uttar Pradesh) for allegedly building it and selling it to private ticket-booking centres — [DT Next](https://www.dtnext.in/amp/story/news/tamilnadu/tn-police-arrest-man-for-creating-fake-software-to-book-tatkal-tickets)
- South Western Railway RPF (2020) reported a racket using software that bypassed both IRCTC and bank OTP safeguards — [Deccan Herald](https://www.deccanherald.com/amp/state/karnataka-districts/south-western-railway-cops-bust-illegal-e-ticket-booking-racket-881239.html)
- Operation Uplabdh (pan-India drive from March 2022): 1,459 touts arrested, of whom 341 were authorised IRCTC agents; future-journey tickets worth over Rs 65 lakh blocked; accused included people in "development and sale of illegal software" via Telegram/WhatsApp along with fake IRCTC IDs and virtual numbers; one accused reportedly admitted being admin of several such tools — [ThePrint](https://theprint.in/india/rpf-arrested-341-irctc-agents-involved-in-ticket-touting-under-month-long-pan-india-drive-operation-uplabdh/899146/); [The Statesman](https://www.thestatesman.com/india/railway-police-crackdown-hi-tech-touts-1503105511.html)
- Uplabdh continues as a standing drive: Eastern Railway reported 137 cases and 150 arrests from 1 April to 31 October 2025 — [Devdiscourse](https://www.devdiscourse.com/article/business/3685910-operation-uplabdh-cracking-down-on-railway-ticket-touting)
- Railways now also files cybercrime complaints against suspicious bookings: "408 complaints have been lodged on the National Cyber Crime Portal pertaining to 4.07 lakh suspicious PNRs" up to 28 Feb 2026 — [Ministry of Railways / PIB release, 25 Mar 2026](https://pubt.io/view/F11A47142392AE0C6666DD1E93C2A558EEA1ABFC)
- Government's stated view of IT Act s.43 generally: it "provides penalty for unauthorised access to computer system" and compensation; a Minister told Rajya Sabha (Feb 2025) that scraping can fall under s.43 — [law.asia](https://law.asia/india-data-scraping-regulation/); [Rajya Sabha answer (snippet only)](https://rsdebate.nic.in/bitstream/123456789/758404/1/PQ_267_07022025_U558_p280_p280.pdf)

### Inferences
- Pattern across every reported case found: (i) the tool was sold/rented or used to book for paying customers, and/or (ii) it defeated a security control (CAPTCHA, OTP, time checks), and/or (iii) it ran on many fake IDs. None involved a private individual's personal, unshared tool on one genuine account.
- The Super Tatkal case is the closest analogue to a "personal assistant" and the key warning: it was reportedly an autofill-style speed-up used by passengers on their own accounts, yet the developer was arrested under s.143(2). What distinguished it from a private tool was public distribution and charging users. Distribution, not autofill as such, looks like the trigger, but IRCTC's statement that helping "few to jump the queue" is itself illegal is broader than that.
- IT Act exposure for tier (c): s.43 (unauthorised access, introducing contaminant, disrupting or denying access) read with s.66 (same acts done dishonestly/fraudulently, up to 3 years and/or Rs 5 lakh fine), and ss.66C/66D (identity theft, cheating by personation) where fake IDs or others' Aadhaar are used. This describes the statute as generally understood; I did not verify it against indiacode this session, and could not confirm which sections were actually charged in which RPF case.

### Gaps
- No primary source (charge-sheet, PIB release) read that lists IT Act sections in ANMS/Real Mango/Nexus/Dragon cases. One search summary says some ANMS-related police FIRs cited IT Act ss.66, 66C, 66D; unverified.
- Nothing found on "Red Mirchi", "Nexus" or "Dragon" specifically in this session; those names remain unsourced here.
- No conviction data found — reports cover arrests only. Trial outcomes, including Yuvarajaa's, are unknown.
- No 2026-specific Operation Uplabdh statistics found.
- Absence of reported end-user prosecutions is not proof none occurred; RPF local cases are thinly reported.

---

## 3. IRCTC Terms of Service on automation, personal use, caps and deactivation; 2025-26 enforcement actions

### Takeaway
IRCTC's current terms flatly say "Use of automation software and/or Scripting Software is strictly prohibited", limit use to personal non-commercial purposes, allow one registration per person, and reserve the right to deactivate IDs and release tickets with no refund and no reason for "suspicious booking activities including usage of scripting tools, or Tatkal Softwares". Enforcement since 2025 is mass and algorithmic: about 3.04 crore IDs deactivated in 2025, a further 2.94 crore suspended pending revalidation, anti-bot filtering, and Aadhaar gating of Tatkal and opening-day bookings.

### Cited Findings
Terms (official PDF on contents.irctc.co.in, read directly; no version date visible in the text):
- "No user can register more than once on the site. Only single user registration is allowed on each unique Email Id and Mobile Number." Multiple IDs: IRCTC may "deactivate all such user registrations and cancel any or all ticket booked using these registrations without any notice" — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- A user who "indulges in suspicious booking activities including usage of scripting tools, or Tatkal Softwares etc., IRCTC reserves the right to deactivate any such user and to release the tickets booked through such User IDs, without providing any reason. Further, no refund of ticket fare will be admissible in such cases of misuse." — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- "IRCTC Website and Mobile Apps are for your personal and non-commercial use. Use of automation software and/or Scripting Software is strictly prohibited." Where "unauthorized carrying out of business of procuring and supplying of Railway tickets using illegal automation software /scripting is found", IRCTC may deactivate users and release tickets with no refund — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- Master List: "Users are advised to keep a maximum of six (6) passengers in their Master Passengers List"; exceeding that makes the list inaccessible, though passengers can still be typed in manually — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- Disclosure: "You agree that IRCTC may provide details of your use of the Web Site to regulators or police or to any other third party" at its discretion — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- General obligations: "You shall not modify, copy, distribute, transmit, display, perform, reproduce, publish, license, create derivative works from, transfer or sell any information, products or services obtained from this Website"; no hyperlinking or framing without written permission; no booking "for the purpose of commercial resale and profit"; "any speculative, false or fraudulent reservation or any reservation in anticipation of demand is prohibited" — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- Monthly cap: Supreme Court recorded it as 12 tickets per month per personal ID, 24 if Aadhaar-verified — [SC judgment, para 19](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf). Older government material describes 6 per month, 12 if Aadhaar-linked with at least one Aadhaar-verified passenger — [Factly](https://factly.in/these-are-the-checks-put-in-place-to-prevent-misuse-of-tatkal-booking/amp). The figures conflict because the cap was raised over time; verify the current number on IRCTC before relying on it.

2025 actions:
- June 2025: Railways announced deactivation of over 2.5 crore suspicious user IDs, an anti-bot system with a CDN provider, and said bot traffic was up to 50% of login attempts in the first minutes of Tatkal opening — [Free Press Journal](https://www.freepressjournal.in/business/indian-railways-deactivates-over-25-crore-indian-railway-catering-tourism-corporation-user-ids); [Business Standard](https://www.business-standard.com/india-news/irctc-deploys-ai-solution-to-curb-illegal-booking-blocks-3-5-cr-fake-ids-125060401414_1.html). Note: the Business Standard/PTI headline says 3.5 crore while most reports say 2.5 crore.
- From 1 July 2025 online Tatkal booking is restricted to Aadhaar-authenticated users; OTP-based Aadhaar authentication for Tatkal from 15 July 2025, extending to counters and agents — [The South First](https://thesouthfirst.com/news/from-1-july-aadhaar-authentication-mandatory-for-tatkal-bookings-on-irctc-website-and-app); [Deccan Herald](https://www.deccanherald.com/amp/story/india%2Frailways-to-mandate-e-aadhaar-for-tatkal-tickets-3572082)
- Non-Aadhaar-authenticated users can book opening-day ARP, Tatkal or Premium Tatkal only 3 days after registration (snippet only) — [News On Air](https://www.newsonair.gov.in/railways-deactivate-more-than-2cr-unauthorised-booking-ids)
- December 2025, Lok Sabha: about 3.02 crore suspicious IDs deactivated since January 2025; "Anti-bot solutions such as AKAMAI are deployed to filter non-genuine users" (Akamai naming is snippet only) — [Millennium Post](https://www.millenniumpost.in/big-stories/irctc-deactivates-302-cr-suspicious-user-ids-in-less-than-12-months-639567); [Angel One](https://www.angelone.in/news/economy/over-3-crore-suspicious-user-ids-deactivated-by-indian-railways-in-less-than-12-months-here-s-why)

2026 actions:
- Official release, 25 March 2026 (read via a PIB mirror): "3.04 crore user accounts were deactivated" in calendar 2025; "2.94 crore user accounts were put under temporary suspension" with option to revalidate; 1,80,474 accounts reactivated between 1 Jan 2025 and 28 Feb 2026; flags include unrealistic mobile numbers, disposable email domains, IP addresses, sequential/gibberish IDs; 13,023 suspicious email domains blocked; anti-bot technology mitigates malicious attempts "to the extent of 64%" on average; "No user account has been deactivated due to non-linking of Aadhaar"; about 88% of reserved tickets booked online — [Ministry of Railways / PIB, 25 Mar 2026](https://pubt.io/view/F11A47142392AE0C6666DD1E93C2A558EEA1ABFC)
- Same release: on the opening day of the advance reservation period, general reserved tickets via website/app are also restricted to Aadhaar-authenticated users — [Ministry of Railways / PIB, 25 Mar 2026](https://pubt.io/view/F11A47142392AE0C6666DD1E93C2A558EEA1ABFC)
- A PIB release of February 2026 reportedly said 60.43 billion malicious bot requests were blocked between July and December 2025 (snippet only) — [pubt.io PIB mirror](https://pubt.io/view/C1FAD9EBF1C4ACD2809ACC5FCC774104EA2FA86B)
- Minister reportedly said about 8.88 billion of 15.38 billion booking attempts in Jan-June 2026 were automated, i.e. over half (snippet only; page returned 403) — [NewsBytes](https://www.newsbytesapp.com/news/india/ashwini-vaishnaw-says-over-half-irctc-booking-attempts-were-bots/tldr)
- September 2026 report: 3.04 crore deactivated and 6.33 crore suspended; wrongly flagged genuine users can seek revalidation via the grievance mechanism. Single unnamed-source article; the 6.33 crore figure conflicts with the 2.94 crore in the March 2026 official release and is unverified — [Channel iAM](https://en.channeliam.com/2026/09/12/irctc-fake-accounts-crackdown-ticket-booking-fraud/)
- A January 2026 "Aadhaar-priority" phase starting 12 Jan 2026 with a longer priority window was reported by a minor outlet (snippet only; unverified) — [PuneNow](https://www.punenow.com/?p=52929)
- A PIL seeking an independent audit of IRCTC's reservation system (Uttam Kumar v. Union of India) is pending in the Delhi High Court, which sought the Centre's stand — [LiveLaw](https://www.livelaw.in/high-court/delhi-high-court/delhi-high-court-seeks-centres-stand-on-pil-for-independent-audit-of-irctc-reservation-system-552472)

### Inferences
- The terms draw no line between "autofill" and "bot": "automation software and/or Scripting Software" is prohibited outright. On a literal reading, tier (b) autofill by a third-party extension and tier (c) full automation both breach the contract; the difference between them lies in detectability, criminal exposure and enforcement appetite, not in the wording.
- The realistic sanction for a genuine single-account user is contractual and automated: deactivation or suspension, release of tickets, and loss of fare, with no reason given. With roughly 6 crore accounts actioned and only about 1.8 lakh reactivated, recovery after a false positive looks slow and uncertain.
- Detection is behavioural and network-based (speed of form completion, IPs, device/browser signals via the anti-bot layer), so sub-second form filling or headless-browser traffic is what gets flagged, regardless of intent.
- Aadhaar gating has changed the economics: one human, one Aadhaar, one account. Multi-account approaches are now both a clear terms breach and practically blocked for Tatkal.

### Gaps
- The terms PDF carries no visible effective date; I cannot confirm when the automation clause was added or whether a newer version exists behind login.
- The monthly cap figure was not found in the terms PDF text itself; it comes from the SC judgment and secondary reports.
- Akamai as the named vendor rests on news snippets quoting a parliamentary reply; the official releases I read name no vendor.
- Bot-share figures (50% of logins; over half of attempts) are government claims without independent audit.

---

## 4. Autofill extensions and third-party apps — have ordinary users been penalised, and what is the sanctioned route?

### Takeaway
I found no official notice, case or reliable report of an ordinary user being prosecuted for an autofill extension, and no IRCTC statement that names browser autofill extensions as permitted or banned; but the terms prohibit "automation software and/or Scripting Software", IRCTC said in 2020 that the equivalent built-in speed features were deliberately disabled, and account suspensions attributed to fast autofill are reported only by blogs. The sanctioned routes are IRCTC's own Master Passenger List and IRCTC-authorised partner apps.

### Cited Findings
- Master Passenger List is an official feature, with a recommended maximum of six saved passengers — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- IRCTC on speed-up features: the Super Tatkal app's features already existed in IRCTC but "were disabled to ensure level playing field for all the users"; time limits and CAPTCHAs exist specifically "to prevent use of any illegal software" — [IRCTC press release, 2 Nov 2020](https://www.irctc.com/assets/images/pressrelease/IIT_Press_release.pdf)
- 2018: IRCTC officials cautioned against apps that claim bookings in seconds using methods like autofill forms (snippet only) — [Hindustan Times via PressReader](https://pressreader.com/india/hindustan-times-lucknow/20180509/281659665676433)
- Autofill extensions are openly listed on the Chrome Web Store and Firefox Add-ons (e.g. "IRCTC Tatkal Autofill Assistant", "AutoMotor"); some vendors state they leave CAPTCHA manual and that bypassing CAPTCHA violates IRCTC terms. These are vendor self-descriptions — [Chrome Web Store listing](https://chromewebstore.google.com/detail/hgiefnnhpkoikmpbdbehpacopdefjnag); [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/automotor/)
- An authorised IRCTC partner (ixigo) markets its own in-app Tatkal autofill — [ixigo](https://www.ixigo.com/trains/irctc-tatkal-autofill)
- Third-party booking platforms need IRCTC authorisation: Delhi High Court (2019) held RailYatri's ticketing operations unauthorised because it was neither a Principal Service Provider nor a Retail Service Provider and had no privity with IRCTC; RailYatri then obtained a licence and was integrated — [LiveLaw](https://livelaw.in/news-updates/railyatris-operations-unauthorized-holds-delhi-hc-while-dismissing-petitions-against-irctc-read-judgment-144084); [Bar & Bench](https://www.barandbench.com/news/rail-yatri-operations-unauthorized-and-impermissible-delhi-high-court); [MediaNama](https://www.medianama.com/2019/04/223-railyatri-applies-for-licence-to-sell-train-tickets-after-defeat-in-high-court/)
- Blog-level claims (not official): third-party extensions that fill Tatkal details in fractions of a second trigger anti-bot rate limiters and cause suspensions; suspended users are told to seek revalidation — [LastBerth blog](https://lastberth.com/blog/how-to-unblock-irctc-id-deactivated-account); [RailMitra blog](https://www.railmitra.com/blog/irctc-account-got-suspended-what-to-do-next)
- Security risk with extensions: Telegram channels sold Aadhaar-verified IRCTC IDs alongside software/extensions that autofill login and payment fields and bypass verification — [The Quint](https://www.thequint.com/news/aadhaar-linked-irctc-accounts-hacked-and-sold-on-telegram)

### Inferences
- Autofill sits in a tolerated-but-unprotected grey zone: widely available, not publicly targeted by RPF when used by individuals, yet within the literal prohibition and liable to trigger automated deactivation with no appeal right beyond a grievance request.
- The safest equivalents of autofill are ones IRCTC itself provides or that involve no script acting on the page: Master List, the browser's or password manager's native credential fill, and saved payment preferences within IRCTC or an authorised partner app.
- If a custom autofill is used anyway, human-speed pacing and leaving login, CAPTCHA, OTP and payment to the person reduce both detection likelihood and the argument that a security control was circumvented. That is risk reduction, not permission.

### Gaps
- No IRCTC or Ministry statement from 2025-26 found that addresses browser autofill extensions by name.
- No verified, documented instance (news report, RTI, court record) of a specific genuine user suspended for autofill alone; only blog assertions.
- Current IRCTC website behaviour (e.g. whether paste/autofill is technically blocked in some fields, quick-book options) was not checked against the live site.

---

## 5. Scraping availability data (IRCTC, ConfirmTkt, erail) and unofficial RapidAPI-style APIs

### Takeaway
Indian law has no scraping-specific statute and no Indian court ruling on scraping public pages that I could find; the exposure is contractual (IRCTC's terms forbid copying/reproducing site information and any automation), plus a contested government view that scraping can amount to unauthorised access under IT Act s.43. For train data specifically I found no litigation over availability scraping; the reported IRCTC disputes concern unauthorised booking/catering services, not data.

### Cited Findings
- No Indian law expressly permits or prohibits web scraping; liability is assessed under the IT Act, contract (website terms), and copyright in compilations/databases — [law.asia](https://law.asia/india-data-scraping-regulation/); [Mondaq](https://www.mondaq.com/india/copyright/900156/data-scraping-and-legal-issues-in-india)
- Government position (Rajya Sabha, Feb 2025): s.43 IT Act penalises unauthorised access and scraping of publicly available user data may be punishable under it; commentators argue this over-reads s.43, which targets unauthorised access rather than collection of openly visible pages, and it has not been definitively applied by a court to public-page scraping — [law.asia](https://law.asia/india-data-scraping-regulation/); [IAPP](https://iapp.org/news/a/scraping-public-data-in-india-innovation-enabler-or-privacy-threat-)
- IRCTC terms: personal non-commercial use only; "You shall not modify, copy, distribute, transmit, display, perform, reproduce, publish… any information, products or services obtained from this Website"; automation/scripting software prohibited — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- IRCTC enforces its exclusivity against unlicensed intermediaries: RailYatri (Delhi HC, 2019) held unauthorised for ticket booking without PSP/RSP status; IRCTC also complained to the Cyber Crime Cell — [LiveLaw](https://livelaw.in/news-updates/railyatris-operations-unauthorized-holds-delhi-hc-while-dismissing-petitions-against-irctc-read-judgment-144084); [Inc42](https://inc42.com/buzz/delhi-high-court-rules-railyatri-operations-as-unauthorised-after-irctc-complaint)
- IRCTC separately confronted RailYatri and TravelKhana over unauthorised e-catering — [Business Standard](https://business-standard.com/article/companies/irctc-locks-horns-with-railyatri-travelkhana-over-food-delivery-119050400043_1.html)
- A clause attributed to IRCTC's API terms requires that all third-party use be by a human user via the API client's interface (unofficial clause database; snippet only) — [Law Insider](https://www.lawinsider.com/clause/automated-use/_3)

### Inferences
- Tier (a) read-only availability checking is the lowest-risk tier legally: no ticket is procured, no one is supplied, so s.143 is not engaged; no fake identity is involved. The remaining exposure is terms breach (automation clause, anti-bot blocking, possible ID deactivation if done logged-in) and, at high volume, an s.43 argument about disrupting or unauthorised access.
- Risk within tier (a) rises in this order: authorised partner apps' own alerts (none) < low-rate personal polling of a third-party site (that site's terms; civil only) < logged-in automated polling of IRCTC (terms breach tied to your account) < bypassing Akamai/anti-bot or CAPTCHA to obtain data (defeating a technical control strengthens an s.43/66 argument).
- Unofficial RapidAPI-style "IRCTC" APIs are almost certainly themselves scrapers or use reverse-engineered endpoints without IRCTC authorisation. The user's legal exposure is mostly indirect (unreliability, the provider being shut off, and sending any personal data such as PNRs to an unknown third party). I found no source confirming their status either way.
- Republishing or commercialising scraped availability data would add database/copyright and unfair-competition issues that a private alert tool does not raise.

### Gaps
- No reported Indian case found involving scraping of IRCTC, NTES, ConfirmTkt or erail.in data, and no reported IRCTC action against a data aggregator purely for data use.
- Nothing found on IRCTC/CRIS API pricing disputes or current API licensing terms and fees; the Law Insider clause is unverified.
- Terms of service of ConfirmTkt and erail.in were not retrieved.
- No authoritative source found on the legality or provenance of RapidAPI IRCTC listings.

---

## 6. Data protection — DPDP Act 2023 and DPDP Rules 2025

### Takeaway
A tool that an individual runs purely for their own and family's travel most likely falls within the DPDP Act's exclusion for personal or domestic processing, so DPDP duties would not attach; that protection is lost once the tool is offered to others or run as a service. The main compliance obligations are in any case not yet in force (reported effective 13 May 2027), so the practical concern today is security of credentials and Aadhaar-linked data rather than regulatory liability.

### Cited Findings
- The DPDP Act does not apply to personal data processed by an individual for any personal or domestic purpose — [TaxGuru guide](https://taxguru.in/corporate-law/dpdp-act-2023-simple-guide-businesses-india.html); [SCC Online on DPDP Rules 2025](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/)
- DPDP Rules 2025 were notified on 13 November 2025 (gazette publication reported as 14 November 2025 by some sources) — [Mondaq](https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified); [Tribune](https://www.tribuneindia.com/news/business/government-notifies-dpdp-rules-to-empower-citizens-protect-privacy)
- Phased commencement: Data Protection Board provisions immediately; consent-manager provisions after one year (about 13-14 November 2026); main compliance obligations after 18 months, reported as 13 May 2027 — [Mondaq update](https://www.mondaq.com/india/privacy-protection/1708314/update-indias-digital-personal-data-protection-framework-comes-into-effect); [Lakshmikumaran & Sridharan](https://lakshmisri.com/insights/articles/digital-personal-data-protection-rules-2025-incremental-tweaks-and-the-way-ahead)
- IRCTC's own terms let it disclose a user's site usage to police/regulators, and its privacy section says it retains personal information as long as reasonably necessary — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- Real-world credential risk: Aadhaar-verified IRCTC accounts have been hijacked and sold on Telegram, bundled with autofill tools that handle login and payment fields — [The Quint](https://www.thequint.com/news/aadhaar-linked-irctc-accounts-hacked-and-sold-on-telegram)

### Inferences
- Family members' names, ages and ID numbers stored locally for household travel are plausibly "domestic purpose". Friends, colleagues or anyone outside the household make that characterisation weaker, and any hosted or shared version makes the operator a data fiduciary once the obligations commence.
- Regardless of DPDP, sensible handling: do not store the IRCTC password, card numbers, CVV, UPI PIN or OTPs in the tool at all (use the OS keychain/password manager and enter payment by hand); store passenger data locally and encrypted; do not store Aadhaar numbers (IRCTC needs the account to be Aadhaar-authenticated, not the tool to hold Aadhaar); never send passenger or credential data to third-party APIs or CAPTCHA-solving services.
- Storing or transmitting other people's Aadhaar numbers raises separate Aadhaar Act restrictions; not researched here.

### Gaps
- Exact statutory wording of s.3(c)(i) DPDP Act was not fetched from indiacode/MeitY this session.
- No guidance or case law found on how broadly "personal or domestic purpose" will be read (e.g. extended family, a tool shared informally with a few friends); the Data Protection Board has no published decisions on it that I found.
- Whether the commencement dates were altered by any 2026 amendment was not checked.
- Aadhaar Act restrictions on storing Aadhaar numbers were not researched.

---

## 7. Map of what is and is not allowed, and best-practice guardrails for a personal tool

### Takeaway
For an individual's own travel: (a) availability alerts carry low legal risk but still breach IRCTC's terms if they script IRCTC itself; (b) human-in-the-loop autofill has no reported criminal enforcement against individual users but is a literal terms breach with a real risk of account deactivation and forfeited fare; (c) full automation, CAPTCHA/OTP bypass, multiple or fake accounts, and booking for others for gain are where s.143, IT Act charges and RPF arrests actually occur. Keeping the tool private, single-account, human-paced and non-circumventing is what keeps it out of tier (c).

### Cited Findings
- Criminal line: unauthorised persons carrying on the business of procuring and supplying tickets, by any mode including e-tickets — [SC judgment, paras 27-30](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf)
- Contract line: "Use of automation software and/or Scripting Software is strictly prohibited"; deactivation, ticket release and no refund for "scripting tools, or Tatkal Softwares"; one registration per user — [IRCTC Terms and Conditions](https://contents.irctc.co.in/en/Terms%20and%20conditions.pdf)
- Terms breaches are for civil/administrative remedy, not s.143 prosecution — [SC judgment, paras 36-37](https://api.sci.gov.in/supremecourt/2017/6192/6192_2017_15_1501_58348_Judgement_09-Jan-2025.pdf); [MP High Court, Aug 2026](https://www.livelaw.in/pdf_upload/2026/08/24/avinash-kumar-soni-v-railway-protection-force-695873.pdf)
- Distributing a paid speed-up app led to arrest under s.143(2) even though passengers booked on their own accounts — [The News Minute](https://thenewsminute.com/article/ready-help-irctc-improve-booking-system-says-tn-techie-arrested-making-app-138513); [IRCTC press release](https://www.irctc.com/assets/images/pressrelease/IIT_Press_release.pdf)
- CAPTCHA and time limits are described by IRCTC as controls against illegal software; Real Mango was characterised by its CAPTCHA bypass — [IRCTC press release](https://www.irctc.com/assets/images/pressrelease/IIT_Press_release.pdf); [Drishti IAS](https://www.drishtiias.com/daily-updates/daily-news-analysis/real-mango-an-illegal-software/print_manually)
- Scale of automated enforcement: 3.04 crore IDs deactivated in 2025, 2.94 crore suspended, 1,80,474 reactivated; 408 cybercrime-portal complaints covering 4.07 lakh PNRs — [Ministry of Railways / PIB, 25 Mar 2026](https://pubt.io/view/F11A47142392AE0C6666DD1E93C2A558EEA1ABFC)

### Inferences
Tier map (synthesis of the findings above; inference, not adjudicated law):

| Tier | Criminal exposure | Terms position | Practical enforcement seen |
|---|---|---|---|
| (a) Read-only availability search/alerts | Low. s.143 not engaged (no procuring/supplying). Residual, contested s.43 IT Act argument only if access controls are bypassed or load is disruptive | Scripting IRCTC breaches the automation clause; third-party sites have their own terms | None found against individuals. Anti-bot blocking; possible ID action if done while logged in |
| (b) Autofill, human does login/CAPTCHA/OTP/payment, own single account, own/family travel | Low for the user on the statute's wording ("business" absent). No reported user prosecutions found | Literal breach ("automation software and/or Scripting Software") | Account deactivation/suspension, ticket release, no refund; reported by blogs, not officially documented |
| (b-plus) Same tool distributed, sold, or used to book for others for a fee | High. s.143(2) abetment for the developer; s.143(1) for whoever books for others as a business | Breach | Super Tatkal developer arrested 2020; Uplabdh arrests of software sellers |
| (c) Unattended booking, CAPTCHA/OTP bypass, multiple/fake/purchased IDs, others' Aadhaar | High. s.143 where tickets go to others; IT Act ss.43/66 and likely 66C/66D for circumvention and identity misuse | Clear breach on several clauses | RPF raids and arrests (ANMS, MAC, Real Mango, Fusion); mass ID deactivation; cybercrime complaints |

Guardrails that follow from the evidence:
1. One genuine, Aadhaar-authenticated IRCTC account belonging to the traveller. Never create, borrow, rent or buy additional IDs.
2. Book only for self and household; no fee, favour-for-payment or resale; stay well inside the monthly ticket cap.
3. Human performs login, CAPTCHA, Aadhaar/bank OTP and payment every time. No CAPTCHA-solving (OCR, ML or human-solver services), no OTP auto-reading and submission, no payment automation.
4. Do not defeat or evade anti-bot controls: no headless-browser stealth, fingerprint spoofing, proxy/IP rotation, or modified/reverse-engineered API calls. If the site blocks the tool, stop.
5. Prefer sanctioned mechanisms first: IRCTC Master Passenger List, the browser's native autofill/password manager, and alerts from IRCTC-authorised partner apps.
6. If custom autofill is used, keep it at human pace and limited to passenger/journey fields; accept that it is still a terms breach and that the account and fare are at risk.
7. For availability alerts, poll slowly (minutes, not seconds), cache results, avoid the Tatkal opening windows, and prefer unauthenticated public pages or authorised partners over logged-in IRCTC sessions.
8. Keep the tool private. Do not publish it as a "booking bot", sell or rent it, run it for others, or advertise speed advantage; distribution is what turned an autofill-style app into an s.143(2) arrest.
9. Store minimal data locally and encrypted; no passwords, card details, OTPs or Aadhaar numbers in the tool; send nothing to third-party APIs.
10. Have a fallback: an account suspension at Tatkal time means no ticket and possibly no refund, so keep the manual route and an authorised partner app available.

### Gaps
- Whether IRCTC or RPF would treat a private, undistributed, human-in-the-loop autofill as "illegal software" has no authoritative answer. IRCTC's 2020 statement that any application helping a few "jump the queue" is illegal suggests a hostile view; the Supreme Court's strict reading of s.143 suggests it would not be criminal. This is the central ambiguity.
- No source establishes a safe request rate or behaviour threshold for IRCTC's anti-bot system; thresholds are not public.
- Position reflects sources available up to November 2026; rules on Aadhaar gating and caps have changed several times in 2025-26 and should be rechecked against IRCTC and PIB before building.
