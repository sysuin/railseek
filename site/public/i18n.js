"use strict";
// Hindi for the page. Translates the page's own wording as it is drawn; train names, station
// names, codes and the booking-sheet sentences from the server stay as they are.
(() => {
  let lang = "en";
  try { lang = localStorage.getItem("railseek.lang") === "hi" ? "hi" : "en"; } catch (e) {}
  document.documentElement.lang = lang;
  window.RS_LOCALE = lang === "hi" ? "hi-IN" : "en-IN";

  const T = {
    "Find a bookable seat when the direct search says no": "सीधी खोज में सीट न मिले, तब भी बुक होने लायक सीट खोजें",
    "Demo data": "डेमो डेटा", "Live data": "लाइव डेटा", "Loading": "लोड हो रहा है",
    "From": "कहाँ से", "To": "कहाँ तक", "Date": "तारीख", "Quota": "कोटा", "General": "सामान्य", "Tatkal": "तत्काल",
    "Passengers": "यात्री", "Find trains": "ट्रेनें खोजें", "Finding": "खोज रहे हैं", "Data": "डेटा", "Live": "लाइव", "Demo": "डेमो",
    "Today": "आज", "Tomorrow": "कल", "Day after": "परसों", "Station name or code": "स्टेशन का नाम या कोड", "Swap stations": "स्टेशन अदला-बदली करें",
    "Same train, other station pairs": "वही ट्रेन, दूसरे स्टेशन जोड़े",
    "Checks booking from an earlier station or to a later one, where a different quota may still have seats, and tells you the boarding point to set.":
      "पहले वाले स्टेशन से या आगे वाले स्टेशन तक बुकिंग जाँचता है, जहाँ दूसरे कोटे में सीट बची हो सकती है, और बताता है कि चढ़ने का स्टेशन क्या रखें।",
    "Best five, automatically": "सबसे अच्छे पाँच, अपने आप",
    "Every search checks all trains and classes, in general and Tatkal quota, and shows the five best options. Tap a class on any train to dig deeper.":
      "हर खोज सभी ट्रेनों और श्रेणियों को सामान्य और तत्काल कोटे में जाँचती है और पाँच सबसे अच्छे विकल्प दिखाती है। किसी ट्रेन की श्रेणी पर टैप करके और गहराई से देखें।",
    "You book, on IRCTC": "बुकिंग आप करें, IRCTC पर",
    "Each result opens a booking sheet with the exact values and steps. railseek never asks for your login and never books or pays.":
      "हर नतीजे में बुकिंग शीट खुलती है, जिसमें भरने वाली जानकारी और कदम होते हैं। railseek कभी आपका लॉगिन नहीं माँगता और न ही बुकिंग या भुगतान करता है।",
    "Availability comes from an unofficial data source and can be out of date or wrong. Always confirm on IRCTC before paying. Timings follow reported 2025-26 rules and are a guide.":
      "उपलब्धता एक अनौपचारिक स्रोत से आती है और पुरानी या गलत हो सकती है। भुगतान से पहले हमेशा IRCTC पर जाँच लें। समय 2025-26 के बताए गए नियमों पर आधारित है और केवल अनुमान है।",
    "Demo shows invented trains. Try SSM to NDLS.": "डेमो में काल्पनिक ट्रेनें हैं। SSM से NDLS आज़माएँ।",
    "Live figures are saved copies, not instant lookups. Each result shows when it was saved.": "लाइव आँकड़े सहेजी गई प्रतियाँ हैं, तुरंत की जाँच नहीं। हर नतीजे के साथ लिखा है कि वह कब सहेजा गया।",
    "Nearby dates": "आसपास की तारीखें", "best option each day for your stations": "हर दिन आपके स्टेशनों के लिए सबसे अच्छा विकल्प",
    "Best options": "सबसे अच्छे विकल्प", "Change trains": "ट्रेन बदलकर", "Start from a nearby station": "पास के स्टेशन से चढ़ें",
    "Share search": "खोज साझा करें", "Share": "साझा करें", "Open IRCTC": "IRCTC खोलें", "Copy details": "विवरण कॉपी करें", "Copied": "कॉपी हो गया",
    "Copy failed": "कॉपी नहीं हुआ", "Copy both tickets": "दोनों टिकट कॉपी करें", "Opened WhatsApp": "WhatsApp खुल गया",
    "Direct": "सीधा", "Earlier origin": "पहले वाले स्टेशन से", "Later destination": "आगे वाले स्टेशन तक", "Extended both ends": "दोनों ओर बढ़ाकर",
    "Nearby station": "पास का स्टेशन", "Book as searched": "जैसा खोजा, वैसा बुक करें",
    "What the colours and codes mean": "रंगों और कोड का मतलब",
    " Confirmed berths are on sale.": " कन्फर्म बर्थ बिक रही हैं।",
    " You can board and share a side berth; it usually becomes a full berth.": " आप यात्रा कर सकते हैं और साइड बर्थ साझा करेंगे; अक्सर यह पूरी बर्थ बन जाती है।",
    " Waitlisted. You may travel only if it confirms or reaches RAC before the chart.": " प्रतीक्षा सूची। चार्ट से पहले कन्फर्म या RAC होने पर ही यात्रा कर सकते हैं।",
    " Booking is closed for this station pair. Another pair on the same train may still be open.": " इस स्टेशन जोड़े के लिए बुकिंग बंद है। उसी ट्रेन में दूसरा जोड़ा खुला हो सकता है।",
    " Not on sale for this pair right now, for example Tatkal before it opens or after it sells out.": " इस जोड़े के लिए अभी बिक्री नहीं, जैसे तत्काल खुलने से पहले या बिक जाने के बाद।",
    " is the general waitlist from the train's starting stations and clears most often. ": " ट्रेन के शुरुआती स्टेशनों की सामान्य प्रतीक्षा सूची है और सबसे ज़्यादा कन्फर्म होती है। ",
    " are smaller waitlists for stations along the route. ": " रास्ते के स्टेशनों की छोटी प्रतीक्षा सूचियाँ हैं। ",
    " is the Tatkal waitlist and clears least often.": " तत्काल प्रतीक्षा सूची है और सबसे कम कन्फर्म होती है।",
    " and ": " और ",
    "Enter these on IRCTC": "IRCTC पर यह भरें", "Timing": "समय", "Steps": "कदम", "Before you pay": "भुगतान से पहले", "Be ready": "तैयारी",
    "Train": "ट्रेन", "Class": "श्रेणी", "Boarding": "चढ़ने का स्टेशन", "Last seen": "आखिरी बार देखा", "Close": "बंद करें",
    "Regret": "रिग्रेट", "Available": "उपलब्ध", "All closed": "सब बंद", "No trains": "कोई ट्रेन नहीं", "could not check": "जाँच नहीं हो सकी",
    "Nothing bookable right now": "अभी कुछ भी बुक नहीं हो सकता", "Looking through every train and class.": "हर ट्रेन और श्रेणी देख रहे हैं।",
    "Every class on every train is closed for this date. Try another date, or look again after the first chart is prepared.":
      "इस तारीख को हर ट्रेन की हर श्रेणी बंद है। दूसरी तारीख आज़माएँ, या पहला चार्ट बनने के बाद फिर देखें।",
    "No trains found for this route and date": "इस रास्ते और तारीख पर कोई ट्रेन नहीं मिली",
    "Check the station codes, or try a nearby station.": "स्टेशन कोड जाँचें, या पास का स्टेशन आज़माएँ।",
    "Demo data: these trains, timings and statuses are invented.": "डेमो डेटा: ये ट्रेनें, समय और स्थिति काल्पनिक हैं।",
    "These are two separate tickets. If the first train runs late you can miss the second, and the second ticket is not refunded for that. Leave a longer wait where you can.":
      "ये दो अलग टिकट हैं। पहली ट्रेन देर से चली तो दूसरी छूट सकती है, और उसके लिए दूसरे टिकट का पैसा वापस नहीं मिलता। हो सके तो ज़्यादा इंतज़ार वाला विकल्प चुनें।",
    "Trains that do not stop at your station. Tap one to search from that station. Allow time to get there; road distance is longer than shown.":
      "ऐसी ट्रेनें जो आपके स्टेशन पर नहीं रुकतीं। उस स्टेशन से खोजने के लिए टैप करें। वहाँ पहुँचने का समय रखें; सड़क की दूरी दिखाई गई दूरी से ज़्यादा होती है।",
    "Nothing bookable on this train in this class": "इस ट्रेन की इस श्रेणी में कुछ भी बुक नहीं हो सकता",
    "Try another class or train, or look again after the first chart is prepared.": "दूसरी श्रेणी या ट्रेन आज़माएँ, या पहला चार्ट बनने के बाद फिर देखें।",
    "Looking at your station pair and others on the same train.": "आपका स्टेशन जोड़ा और उसी ट्रेन के दूसरे जोड़े देख रहे हैं।",
    "Alert me": "सूचना दें", "Two tickets": "दो टिकट", "Waitlist trend": "प्रतीक्षा सूची का रुझान", "Not moving.": "आगे नहीं बढ़ रही।",
    "No change since railseek first saw this option.": "railseek ने जब से यह विकल्प देखा, तब से कोई बदलाव नहीं।",
    "No earlier figures saved yet. They build up as people search.": "अभी पुराने आँकड़े सहेजे नहीं गए हैं। लोग जैसे-जैसे खोजते हैं, ये जुड़ते जाते हैं।", "Alert set": "सूचना लगा दी", "Setting alert": "सूचना लगा रहे हैं", "Your alerts": "आपकी सूचनाएँ", "Remove": "हटाएँ",
    "checked about every 30 minutes; notifications come to this browser": "लगभग हर 30 मिनट में जाँच; सूचनाएँ इसी ब्राउज़र में आएँगी",
    "Send a test notification": "परीक्षण सूचना भेजें", "Test sent": "परीक्षण भेज दिया", "Switch to live data for alerts": "सूचना के लिए लाइव डेटा चुनें",
  };
  const P = [
    [/^(\d+) seats?$/, "$1 सीट"], [/^(\d+) trains?$/, "$1 ट्रेनें"], [/^(\d+)% chance$/, "$1% संभावना"],
    [/(\d+)% chance/g, "$1% संभावना"], [/saved (\d+) min ago/g, "$1 मिनट पहले सहेजा"], [/saved (\d+) h ago/g, "$1 घंटे पहले सहेजा"], [/saved (\d+) days ago/g, "$1 दिन पहले सहेजा"],
    [/^(\d+) of (\d+) trains bookable$/, "$2 में से $1 ट्रेनें बुक हो सकती हैं"],
    [/^checking trains, (\d+) of (\d+) done$/, "ट्रेनें जाँच रहे हैं, $2 में से $1 हो गईं"],
    [/^from (\d+) trains?, all classes, general and Tatkal$/, "$1 ट्रेनों से, सभी श्रेणियाँ, सामान्य और तत्काल"],
    [/^from (\d+) trains?, all classes, general quota \(Tatkal opens the day before travel\)$/, "$1 ट्रेनों से, सभी श्रेणियाँ, सामान्य कोटा (तत्काल यात्रा से एक दिन पहले खुलता है)"],
    [/^some trains could not be checked$/, "कुछ ट्रेनें जाँची नहीं जा सकीं"],
    [/^Change at (.+)$/, "$1 पर ट्रेन बदलें"], [/^via (.+)$/, "$1 होकर"],
    [/^Key moments, boarding at (.+)$/, "अहम समय, $1 से चढ़ने पर"],
    [/^Checking (\S+) in (\S+)$/, "$1 की $2 श्रेणी जाँच रहे हैं"],
    [/^All trains on this route with (general|Tatkal)-quota status for your stations\. Tap a class to check other station pairs on that train, even when it shows Regret\.$/,
      (m, q) => `इस रास्ते की सभी ट्रेनें, आपके स्टेशनों के लिए ${q === "Tatkal" ? "तत्काल" : "सामान्य"} कोटे की स्थिति के साथ। उस ट्रेन के दूसरे स्टेशन जोड़े देखने के लिए श्रेणी पर टैप करें, रिग्रेट दिखे तब भी।`],
    [/(\d+) h (\d+) min/g, "$1 घं $2 मि"], [/(\d+) h\b/g, "$1 घं"], [/ wait\b/g, " इंतज़ार"], [/\(tight\)/g, "(कम समय)"], [/ in all\b/g, " कुल"],
    [/^from (.+) \((\w+)\), about (\d+) km away$/, "$1 ($2) से, लगभग $3 किमी दूर"], [/, straight-line distance$/, ", सीधी दूरी"],
    [/^(\d+) checks/, "$1 जाँच"], [/^Moving: WL (\d+) to WL (\d+) since (.+)\.$/, "आगे बढ़ रही: $3 से WL $1 से WL $2 तक।"], [/^Getting longer: WL (\d+) to WL (\d+) since (.+)\.$/, "लंबी हो रही: $3 से WL $1 से WL $2 तक।"], [/^Ticket (\d): enter on IRCTC$/, "टिकट $1: IRCTC पर यह भरें"],
    [/^Two tickets on the same train: (\S+) and (\S+)\. Berth may change at (\S+)\.$/, "उसी ट्रेन में दो टिकट: $1 और $2। $3 पर बर्थ बदल सकती है।"],
    [/^Two separate tickets on the same train\. You may have to move to another berth at (\S+), and each ticket confirms on its own\.$/, "उसी ट्रेन में दो अलग टिकट। $1 पर दूसरी बर्थ पर जाना पड़ सकता है, और हर टिकट अलग से कन्फर्म होता है।"], [/Tatkal reminder /g, "तत्काल याद "], [/chart reminder /g, "चार्ट याद "], [/\bends /g, "समाप्त "],
    [/^Fares are shown for (\d+) passengers\. On a waitlist, every passenger on one ticket has to confirm, so a large group confirms less often than one person\.$/,
      "किराया $1 यात्रियों का दिखाया गया है। प्रतीक्षा सूची में एक टिकट के सभी यात्रियों का कन्फर्म होना ज़रूरी है, इसलिए बड़े समूह का टिकट एक व्यक्ति की तुलना में कम कन्फर्म होता है।"],
    [/^A Tatkal ticket can carry at most 4 passengers\..*$/, "एक तत्काल टिकट पर अधिकतम 4 यात्री हो सकते हैं। बड़े समूह के लिए दो बुकिंग करनी होंगी, और बर्थ साथ में न मिलें, ऐसा हो सकता है।"],
    [/Book from (\S+) and set boarding point to (\S+)/g, "$1 से बुक करें और चढ़ने का स्टेशन $2 रखें"],
    [/journey date on IRCTC is (.+?) \(when the train leaves (\S+)\)/g, "IRCTC पर यात्रा तारीख $1 डालें (जिस दिन ट्रेन $2 से चलती है)"],
    [/Book to (\S+), get off at (\S+)/g, "$1 तक बुक करें, $2 पर उतरें"], [/arrives at (\S+)/g, "$1 पहुँचती है"], [/Get to (\S+) first/g, "पहले $1 पहुँचें"],
    [/(\d+) km\b/g, "$1 किमी"], [/ or /g, " या "], [/ for (\d+)$/, " ($1 यात्री)"],
  ];
  function tr(s) {
    if (!s || !/[A-Za-z]/.test(s)) return s;
    if (s.includes("  ·  ")) return s.split("  ·  ").map(tr).join("  ·  ");   // e.g. "21 Nov  ·  3A  ·  General"
    if (T[s] !== undefined) return T[s];
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
    if (T[core] !== undefined) return lead + T[core] + trail;
    let out = s;
    for (const [re, rep] of P) out = out.replace(re, rep);
    return out;
  }
  function walk(node) {
    if (node.nodeType === 3) { const t = tr(node.nodeValue); if (t !== node.nodeValue) node.nodeValue = t; return; }
    if (node.nodeType !== 1 || node.tagName === "SCRIPT" || node.tagName === "STYLE" || node.tagName === "INPUT" && node.type !== "button") {
      if (node.nodeType === 1 && node.placeholder) node.placeholder = tr(node.placeholder);
      return;
    }
    for (const a of ["title", "aria-label", "placeholder"]) if (node.hasAttribute && node.hasAttribute(a)) { const t = tr(node.getAttribute(a)); if (t !== node.getAttribute(a)) node.setAttribute(a, t); }
    for (const c of node.childNodes) walk(c);
  }
  function addToggle() {
    const top = document.querySelector("header.top .wrap");
    if (!top) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "lang"; b.id = "lang";
    b.textContent = lang === "hi" ? "English" : "हिंदी";
    b.setAttribute("aria-label", lang === "hi" ? "Switch to English" : "हिंदी में देखें");
    b.addEventListener("click", () => { try { localStorage.setItem("railseek.lang", lang === "hi" ? "en" : "hi"); } catch (e) {} location.reload(); });
    top.appendChild(b);
  }
  document.addEventListener("DOMContentLoaded", () => {
    addToggle();
    if (lang !== "hi") return;
    walk(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === "characterData") walk(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
