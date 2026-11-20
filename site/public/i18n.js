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
    "Alert me": "सूचना दें", "may have changed": "बदल चुका हो सकता है", "Copy": "कॉपी करें", "Two tickets": "दो टिकट", "Waitlist trend": "प्रतीक्षा सूची का रुझान", "Not moving.": "आगे नहीं बढ़ रही।",
    "No change since railseek first saw this option.": "railseek ने जब से यह विकल्प देखा, तब से कोई बदलाव नहीं।",
    "No earlier figures saved yet. They build up as people search.": "अभी पुराने आँकड़े सहेजे नहीं गए हैं। लोग जैसे-जैसे खोजते हैं, ये जुड़ते जाते हैं।", "Alert set": "सूचना लगा दी", "Setting alert": "सूचना लगा रहे हैं", "Your alerts": "आपकी सूचनाएँ", "Remove": "हटाएँ",
    "checked about every 30 minutes; notifications come to this browser": "लगभग हर 30 मिनट में जाँच; सूचनाएँ इसी ब्राउज़र में आएँगी",
    "Send a test notification": "परीक्षण सूचना भेजें", "Test sent": "परीक्षण भेज दिया", "Switch to live data for alerts": "सूचना के लिए लाइव डेटा चुनें",
    "At most 4 passengers per Tatkal booking. A confirmed Tatkal ticket cannot be refunded.": "एक तत्काल बुकिंग में अधिकतम 4 यात्री। कन्फर्म तत्काल टिकट का पैसा वापस नहीं मिलता।",
    "Confirmed Tatkal tickets are never refundable.": "कन्फर्म तत्काल टिकट का पैसा कभी वापस नहीं मिलता।",
    "Current booking closes (about 30 minutes before departure)": "करंट बुकिंग बंद (रवानगी से लगभग 30 मिनट पहले)",
    "Decide now whether to tick Vikalp (alternate train) and auto-upgrade, so you do not stop to think on the form.": "विकल्प (दूसरी ट्रेन) और ऑटो-अपग्रेड पर अभी तय कर लें, ताकि फ़ॉर्म भरते समय रुकना न पड़े।",
    "Emergency quota request deadline": "आपातकालीन कोटा अनुरोध की अंतिम समय-सीमा",
    "First chart due; leftover berths go on sale as current booking": "पहला चार्ट; बची बर्थ करंट बुकिंग में बिकती हैं",
    "From now, cancelling costs 25% of the fare": "अब से रद्द करने पर किराए का 25% कटेगा",
    "From now, cancelling costs 50% of the fare": "अब से रद्द करने पर किराए का 50% कटेगा",
    "From now, cancelling gives no refund": "अब से रद्द करने पर कोई पैसा वापस नहीं",
    "Have a second choice from the search results written down in case the first is gone.": "पहला विकल्प न मिले तो उसके लिए खोज नतीजों में से दूसरा विकल्प लिखकर रखें।",
    "IRCTC login works on the device you will use (try it today, not at booking time).": "जिस फ़ोन या कंप्यूटर से बुक करेंगे, उस पर IRCTC लॉगिन चलता हो (आज ही जाँच लें, बुकिंग के समय नहीं)।",
    "Log in 3 to 5 minutes before opening time. Earlier risks a session timeout; later risks the login queue.": "खुलने से 3 से 5 मिनट पहले लॉगिन करें। पहले करने पर सत्र समाप्त हो सकता है; बाद में करने पर लॉगिन की कतार लग सकती है।",
    "Needs a genuine forwarding authority. Based on the train's departure from its first station.": "किसी अधिकृत व्यक्ति/कार्यालय की सिफ़ारिश ज़रूरी। ट्रेन के पहले स्टेशन से चलने के समय पर आधारित।",
    "Passengers are saved in My Profile > Master List, with names and ages exactly as on their ID.": "यात्री My Profile > Master List में सहेजे हों, नाम और उम्र ठीक वैसे ही जैसे पहचान पत्र पर हैं।",
    "Payment is ready: IRCTC eWallet topped up, or a UPI app open on your phone. Avoid cards that need a slow bank OTP.": "भुगतान तैयार रखें: IRCTC eWallet में पैसे हों, या फ़ोन पर UPI ऐप खुला हो। जिन कार्ड में बैंक OTP देर से आता है, उनसे बचें।",
    "Pick passengers from your Master List.": "अपनी Master List से यात्री चुनें।",
    "Refund: none if you cancel from now on.": "रिफ़ंड: अब रद्द करने पर कुछ वापस नहीं।",
    "Review the fare, pay, and save the PNR.": "किराया जाँचें, भुगतान करें और PNR सहेज लें।",
    "Tatkal opens for AC classes": "AC श्रेणियों के लिए तत्काल खुलता है",
    "Tatkal opens for non-AC classes": "नॉन-AC श्रेणियों के लिए तत्काल खुलता है",
    "The phone linked to your Aadhaar is next to you and has signal, for the booking OTP.": "आधार से जुड़ा फ़ोन पास में हो और उसमें नेटवर्क हो, बुकिंग OTP के लिए।",
    "The status above came from an unofficial source. What IRCTC shows at step 3 is what counts.": "ऊपर की स्थिति एक अनौपचारिक स्रोत से है। कदम 3 में IRCTC जो दिखाए, वही मान्य है।",
    "This is a waitlist. If it is still waitlisted at charting, an e-ticket is cancelled and refunded, and you cannot board on it.": "यह प्रतीक्षा सूची है। चार्ट बनने तक भी प्रतीक्षा में रहा तो ई-टिकट रद्द होकर पैसा लौट जाता है, और उस पर यात्रा नहीं कर सकते।",
    "This option was closed or unreadable when last checked. Re-run the search before trying it.": "पिछली जाँच में यह विकल्प बंद था या पढ़ा नहीं जा सका। आज़माने से पहले फिर से खोजें।",
    "Whether a Tatkal ticket allows a boarding-point change is unconfirmed. Check on IRCTC before paying.": "तत्काल टिकट पर चढ़ने का स्टेशन बदल सकते हैं या नहीं, यह पक्का नहीं है। भुगतान से पहले IRCTC पर जाँच लें।",
    "Your IRCTC account is Aadhaar-authenticated (My Profile > Authenticate User). Tatkal is refused without it.": "आपका IRCTC खाता आधार से सत्यापित हो (My Profile > Authenticate User)। इसके बिना तत्काल नहीं मिलता।",
    "must be set, or your berth can be given away": "यह ज़रूर बदलें, वरना आपकी बर्थ किसी और को दी जा सकती है",
    "Pick passengers from your Master List": "अपनी Master List से यात्री चुनें",
    "passed": "बीत गया",
    "General (GN)": "सामान्य (GN)",
    "Tatkal (TQ)": "तत्काल (TQ)",
    "Sort": "क्रम",
    "Leaves": "रवाना",
    "Best chance": "सबसे अच्छी संभावना",
    "Cheapest": "सबसे सस्ता",
    "Leaves earliest": "सबसे पहले रवाना",
    "Any time": "कभी भी",
    "Morning (4 am to noon)": "सुबह (4 से 12 बजे)",
    "Afternoon (noon to 5 pm)": "दोपहर (12 से 5 बजे)",
    "Evening and night": "शाम और रात",
    "All classes": "सभी श्रेणियाँ",
    "AC only": "केवल AC",
    "Sleeper and seats": "स्लीपर और सीटें",
    "Recent": "हाल की खोज",
    "Nothing matches these filters": "इन फ़िल्टर से कुछ नहीं मिला",
    "There are bookable options at other times or in other classes. Change the filters above.": "दूसरे समय या दूसरी श्रेणी में बुक होने लायक विकल्प हैं। ऊपर के फ़िल्टर बदलें।",
    "Tatkal checklist": "तत्काल की तैयारी",
    "Get these ready before opening time": "खुलने से पहले यह सब तैयार रखें",
    "Tatkal for tomorrow opened this morning. Tatkal seats often sell out within minutes, but cancellations reappear.": "कल के लिए तत्काल आज सुबह खुल गया। तत्काल सीटें अक्सर मिनटों में बिक जाती हैं, पर रद्द होने पर फिर दिखती हैं।",
    "Trains that start their run the day before they reach you open Tatkal a day earlier, so for some trains it opens today. Each train's key moments are in its booking sheet.": "जो ट्रेनें आपके स्टेशन से एक दिन पहले चलना शुरू करती हैं, उनका तत्काल एक दिन पहले खुलता है, इसलिए कुछ ट्रेनों का आज खुलेगा। हर ट्रेन के अहम समय उसकी बुकिंग शीट में हैं।",
    "Add to calendar": "कैलेंडर में जोड़ें",
    "Route and coaches": "रूट और कोच",
    "Route shown below": "रूट नीचे दिखाया",
    "Return trip": "वापसी यात्रा",
    "Route": "रूट",
    "Coach order": "कोच क्रम",
    "Loading the route…": "रूट लोड हो रहा है…",
    "start": "शुरू",
    "runs daily": "रोज़ चलती है",
    "book from": "यहाँ से बुक",
    "you board": "आप चढ़ेंगे",
    "you get off": "आप उतरेंगे",
    "book to": "यहाँ तक बुक",
    "From the engine end, as published. It can change on the day, so check the coach position board at the station.": "इंजन की ओर से, जैसा प्रकाशित है। यात्रा के दिन बदल सकता है, इसलिए स्टेशन पर कोच स्थिति बोर्ड देखें।",
    "All of this train's key moments have already passed.": "इस ट्रेन के सभी अहम समय बीत चुके हैं।",
    "Stations swapped for the return trip. Pick the return date, then press Find trains.": "वापसी यात्रा के लिए स्टेशन बदल दिए। वापसी की तारीख चुनें, फिर ट्रेनें खोजें दबाएँ।",
    "Tatkal opening, chart time and departure, with reminders": "तत्काल खुलना, चार्ट का समय और रवानगी, याद दिलाने के साथ",
    "What to do": "क्या करें", "See it": "देखें",
    "still checking other options": "दूसरे विकल्प अभी जाँच रहे हैं",
    "Working out your best move…": "आपके लिए सबसे अच्छा कदम निकाल रहे हैं…",
    "Confirmed seats": "कन्फर्म सीटें",
    "RAC: you can travel": "RAC: यात्रा कर सकते हैं",
    "Chance unknown": "संभावना पता नहीं",
    "Likely to confirm": "कन्फर्म होने की संभावना ज़्यादा",
    "May confirm": "कन्फर्म हो सकता है",
    "Unlikely to confirm": "कन्फर्म होने की संभावना कम",
    "Closed": "बंद",
    "See how to book": "बुक करने का तरीका देखें",
    "See the connection": "कनेक्शन देखें",
    "See the best waitlist": "सबसे अच्छी प्रतीक्षा सूची देखें",
    "No confirmed seat right now": "अभी कोई कन्फर्म सीट नहीं",
    "Few are left, so book soon.": "कम बची हैं, जल्दी बुक करें।",
    "Tatkal for tomorrow has opened. Seats go fast, but cancelled Tatkal berths reappear, so look again during the day.": "कल के लिए तत्काल खुल चुका है। सीटें जल्दी जाती हैं, पर रद्द हुई तत्काल बर्थ फिर दिखती हैं, इसलिए दिन में फिर देखें।",
    "For travel today, charts are out for most trains. Berths left after the chart are sold as current booking until about 30 minutes before departure; look under Book Ticket on IRCTC.": "आज की यात्रा के लिए ज़्यादातर ट्रेनों का चार्ट बन चुका है। चार्ट के बाद बची बर्थ रवानगी से लगभग 30 मिनट पहले तक करंट बुकिंग में बिकती हैं; IRCTC पर Book Ticket में देखें।",
    "Set an alert on a waitlisted option to get a notification when it moves, and before Tatkal and chart time.": "प्रतीक्षा सूची वाले विकल्प पर सूचना लगाएँ, ताकि उसके आगे बढ़ने पर और तत्काल व चार्ट से पहले सूचना मिले।",
    "Every train and class is closed for your stations. The tips below are your best moves.": "आपके स्टेशनों के लिए हर ट्रेन और श्रेणी बंद है। नीचे के सुझाव आपके सबसे अच्छे कदम हैं।",
    "Watch for seats": "सीट पर नज़र रखें",
    "Watching": "नज़र रख रहे हैं",
    "Buses": "बसें",
    "Watch this route: get a notification as soon as any train shows confirmed or RAC seats for your stations.": "इस रास्ते पर नज़र रखें: आपके स्टेशनों के लिए किसी भी ट्रेन में कन्फर्म या RAC सीट दिखते ही सूचना पाएँ।",
    "all classes": "सभी श्रेणियाँ",
  };
  const P = [
    [/\bin (\d+) h (\d+) min\b/g, "$1 घं $2 मि में"], [/\bin (\d+) min\b/g, "$1 मि में"],
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
    [/^(\d+) checks/, "$1 जाँच"], [/^Route of (\S+)$/, "$1 का रूट"], [/^day (\d+)/, "दिन $1"], [/(\d+):(\d+) h end to end/, "$1:$2 घं कुल"], [/^Copy (\S+)$/, "$1 कॉपी करें"], [/^Moving: WL (\d+) to WL (\d+) since (.+)\.$/, "आगे बढ़ रही: $3 से WL $1 से WL $2 तक।"], [/^Getting longer: WL (\d+) to WL (\d+) since (.+)\.$/, "लंबी हो रही: $3 से WL $1 से WL $2 तक।"], [/^Ticket (\d): enter on IRCTC$/, "टिकट $1: IRCTC पर यह भरें"],
    [/^Two tickets on the same train: (\S+) and (\S+)\. Berth may change at (\S+)\.$/, "उसी ट्रेन में दो टिकट: $1 और $2। $3 पर बर्थ बदल सकती है।"],
    [/^Two separate tickets on the same train\. You may have to move to another berth at (\S+), and each ticket confirms on its own\.$/, "उसी ट्रेन में दो अलग टिकट। $1 पर दूसरी बर्थ पर जाना पड़ सकता है, और हर टिकट अलग से कन्फर्म होता है।"], [/Tatkal reminder /g, "तत्काल याद "], [/chart reminder /g, "चार्ट याद "], [/\bends /g, "समाप्त "],
    [/^Fares are shown for (\d+) passengers\. On a waitlist, every passenger on one ticket has to confirm, so a large group confirms less often than one person\.$/,
      "किराया $1 यात्रियों का दिखाया गया है। प्रतीक्षा सूची में एक टिकट के सभी यात्रियों का कन्फर्म होना ज़रूरी है, इसलिए बड़े समूह का टिकट एक व्यक्ति की तुलना में कम कन्फर्म होता है।"],
    [/^A Tatkal ticket can carry at most 4 passengers\..*$/, "एक तत्काल टिकट पर अधिकतम 4 यात्री हो सकते हैं। बड़े समूह के लिए दो बुकिंग करनी होंगी, और बर्थ साथ में न मिलें, ऐसा हो सकता है।"],
    [/Book from (\S+) and set boarding point to (\S+)/g, "$1 से बुक करें और चढ़ने का स्टेशन $2 रखें"],
    [/journey date on IRCTC is (.+?) \(when the train leaves (\S+)\)/g, "IRCTC पर यात्रा तारीख $1 डालें (जिस दिन ट्रेन $2 से चलती है)"],
    [/Book to (\S+), get off at (\S+)/g, "$1 तक बुक करें, $2 पर उतरें"], [/arrives at (\S+)/g, "$1 पहुँचती है"], [/Get to (\S+) first/g, "पहले $1 पहुँचें"],
    [/^not (\S+): you book from an earlier station$/, "$1 नहीं: आप पहले वाले स्टेशन से बुक कर रहे हैं"],
    [/^not (\S+): you book past your stop$/, "$1 नहीं: आप अपने स्टेशन से आगे तक बुक कर रहे हैं"],
    [/^the day the train leaves (\S+); you board on (.+)$/, "जिस दिन ट्रेन $1 से चलती है; आप $2 को चढ़ेंगे"],
    [/^(.+), saved (\d+ \w+ \d\d:\d\d) \((.+)\)$/, (m, st, d, x) => `${st}, ${d} को सहेजा (${x.replace(/about Rs (\d+) per adult/, "प्रति वयस्क लगभग ₹$1")})`],
    [/^(.+), saved (\d+ \w+ \d\d:\d\d)$/, "$1, $2 को सहेजा"],
    [/^Tatkal opens (.+) at (\d\d:\d\d) \((.+)\)\.$/, "तत्काल $1 को $2 बजे खुलेगा ($3)।"],
    [/^Tatkal opens at (\d\d:\d\d) the day before the train starts its run\.$/, "तत्काल, ट्रेन के चलने से एक दिन पहले $1 बजे खुलता है।"],
    [/^Train leaves (\S+) (.+) at (\d\d:\d\d) \((.+)\)\.$/, "ट्रेन $1 से $2 को $3 बजे चलेगी ($4)।"],
    [/^Train leaves (\S+)$/, "ट्रेन $1 से चलती है"],
    [/^Refund: cancelling now loses 25% of the fare; 50% after (.+)\.$/, "रिफ़ंड: अभी रद्द करने पर किराए का 25% कटेगा; $1 के बाद 50%।"],
    [/^Refund: cancelling now loses 50% of the fare; nothing back after (.+)\.$/, "रिफ़ंड: अभी रद्द करने पर किराए का 50% कटेगा; $1 के बाद कुछ वापस नहीं।"],
    [/^Open IRCTC \((\S+)\) or the IRCTC Rail Connect app and log in\.$/, "IRCTC ($1) या IRCTC Rail Connect ऐप खोलें और लॉगिन करें।"],
    [/^Search From (\S+), To (\S+), date (.+), quota (.+)\.$/, (m, a, b, d, q) => `खोजें: कहाँ से ${a}, कहाँ तक ${b}, तारीख ${d}, कोटा ${q === "Tatkal" ? "तत्काल" : q === "General" ? "सामान्य" : q}।`],
    [/^Find train (\S+), choose class (\S+), and check the status shown matches what you expect\.$/, "ट्रेन $1 ढूँढें, श्रेणी $2 चुनें, और देखें कि दिखाई गई स्थिति आपकी उम्मीद के मुताबिक़ है।"],
    [/^On the passenger page, set the boarding station to (\S+)\. If the page does not offer it, change it afterwards under Booked Ticket History > Change Boarding Point \(allowed once\)\.$/,
      "यात्री वाले पेज पर चढ़ने का स्टेशन $1 रखें। अगर वहाँ विकल्प न मिले, तो बाद में Booked Ticket History > Change Boarding Point में बदलें (एक बार ही)।"],
    [/^Open the ticket and confirm the boarding point reads (\S+)\.$/, "टिकट खोलकर देखें कि चढ़ने का स्टेशन $1 लिखा है।"],
    [/^You pay the fare from (\S+), which is more than from (\S+)\.$/, "किराया $1 से लगेगा, जो $2 से ज़्यादा है।"],
    [/^You pay the fare to (\S+) and get off early at (\S+)\. Nothing needs changing on the ticket\.$/, "किराया $1 तक लगेगा और आप पहले $2 पर उतरेंगे। टिकट में कुछ बदलना नहीं है।"],
    [/^Counted from the day the train starts at (\S+) \((.+?)\), so it opens on (.+?)\. Some sources count from your boarding date, which would make it open on (.+?)\. Check on IRCTC\.$/,
      "गिनती उस दिन से जब ट्रेन $1 से चलती है ($2), इसलिए यह $3 को खुलता है। कुछ स्रोत आपके चढ़ने की तारीख से गिनते हैं, तब यह $4 को खुलेगा। IRCTC पर जाँच लें।"],
    [/^Estimated from the train's departure from (\S+)\. Stations far down the route can have their own later chart\.$/, "ट्रेन के $1 से चलने के समय के आधार पर अनुमान। रास्ते में काफ़ी आगे के स्टेशनों का चार्ट बाद में बन सकता है।"],
    [/^Whether this runs up to departure from (\S+) or from an earlier station is unconfirmed\.$/, "यह $1 से रवानगी तक चलती है या किसी पहले स्टेशन तक, पक्का नहीं है।"],
    [/\(in (\d+)d (\d+)h\)/g, "($1 दिन $2 घं में)"], [/\(in (\d+)h (\d+)m\)/g, "($1 घं $2 मि में)"], [/\(in (\d+)m\)/g, "($1 मि में)"], [/\(passed\)/g, "(बीत गया)"],
    [/^in (\d+)d (\d+)h$/, "$1 दिन $2 घं में"], [/^in (\d+)h (\d+)m$/, "$1 घं $2 मि में"], [/^in (\d+)m$/, "$1 मि में"],
    [/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(?=,? \d)/g, d => ({ Mon: "सोम", Tue: "मंगल", Wed: "बुध", Thu: "गुरु", Fri: "शुक्र", Sat: "शनि", Sun: "रवि" })[d]],
    [/(\d )(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m, n, mo) => n + ({ Jan: "जन॰", Feb: "फ़र॰", Mar: "मार्च", Apr: "अप्रैल", May: "मई", Jun: "जून", Jul: "जुल॰", Aug: "अग॰", Sep: "सित॰", Oct: "अक्तू॰", Nov: "नव॰", Dec: "दिस॰" })[mo]],
    [/^Tatkal for tomorrow opens today: 10:00 for AC \((.+?)\), 11:00 for sleeper and seats \((.+?)\)\.$/, "कल के लिए तत्काल आज खुलेगा: AC के लिए 10:00 बजे ($1), स्लीपर और सीटों के लिए 11:00 बजे ($2)।"],
    [/^Tatkal for AC classes opened at 10:00\. Sleeper and seats open at 11:00 \((.+?)\)\.$/, "AC श्रेणियों का तत्काल 10:00 बजे खुल गया। स्लीपर और सीटों का 11:00 बजे खुलेगा ($1)।"],
    [/^Search (\S+) to (\S+) again$/, "$1 से $2 फिर खोजें"],
    [/^Or stay on one train: (.+), (\S+), (.+) with a (\d+)% chance of confirming\.$/, "या एक ही ट्रेन में रहें: $1, $2, $3, कन्फर्म होने की $4% संभावना।"],
    [/^Flights from (\S+)$/, "$1 से उड़ानें"], [/^Any seat, (\S+) → (\S+)$/, "कोई भी सीट, $1 → $2"], [/best now /g, "अभी सबसे अच्छा "],
    [/^No likely train seat\? Flights to (.+?) leave from (.+)\. Buses are worth a look too\.$/, (m, t, f) => `ट्रेन में सीट की उम्मीद कम है? ${t} के लिए उड़ानें ${f.replace(/ km away/g, " किमी दूर").replace(/ or /g, " या ")} से मिलती हैं। बसें भी देख लें।`],
    [/^Book now: (.+), (\S+)$/, "अभी बुक करें: $1, $2"], [/^Book RAC now: (.+), (\S+)$/, "अभी RAC बुक करें: $1, $2"],
    [/^Two trains with seats, changing at (.+)$/, "सीटों वाली दो ट्रेनें, $1 पर बदलकर"], [/^Seats from (.+), about (\d+) km away$/, "$1 से सीटें, लगभग $2 किमी दूर"],
    [/^Best bet: (.+), (\S+), (\d+)% chance$/, "सबसे अच्छा दाँव: $1, $2, $3% संभावना"], [/^Seats on (.+) instead$/, "$1 को सीटें हैं"],
    [/^Search from (\S+)$/, "$1 से खोजें"], [/^Search (.+)$/, "$1 खोजें"],
    [/^(\d+) seats? showing for (\S+) to (\S+)\. /, "$2 से $3 के लिए $1 सीटें दिख रही हैं। "], [/^Seats showing for (\S+) to (\S+)\. /, "$1 से $2 के लिए सीटें दिख रही हैं। "],
    [/^No confirmed seats yet\. This waitlist \((.+?)\) is likely to confirm\. Book it, then set an alert so you hear if it changes\.$/, "अभी कन्फर्म सीट नहीं। यह प्रतीक्षा सूची ($1) कन्फर्म होने की संभावना ज़्यादा है। इसे बुक करें, फिर सूचना लगाएँ ताकि बदलाव का पता चले।"],
    [/^RAC lets you board and share a side berth; it usually becomes a full berth by the chart\. ?/, "RAC पर आप चढ़ सकते हैं और साइड बर्थ साझा करते हैं; चार्ट तक अक्सर पूरी बर्थ मिल जाती है। "],
    [/^Tatkal for tomorrow opens today at 10:00 for AC and 11:00 for sleeper and seats\. It is often the best chance of a confirmed berth at short notice\.$/, "कल के लिए तत्काल आज खुलेगा: AC 10:00 बजे, स्लीपर और सीटें 11:00 बजे। कम समय में कन्फर्म बर्थ का यह अक्सर सबसे अच्छा मौका होता है।"],
    [/^Tatkal for tomorrow opens today at 11:00 for sleeper and seats \(AC opened at 10:00\)\. It is often the best chance of a confirmed berth at short notice\.$/, "कल के लिए स्लीपर और सीटों का तत्काल आज 11:00 बजे खुलेगा (AC 10:00 बजे खुल गया)। कम समय में कन्फर्म बर्थ का यह अक्सर सबसे अच्छा मौका होता है।"],
    [/^The first chart for (\S+) is due around (.+?)\. Waitlisted e-tickets that do not confirm are then cancelled and refunded, and leftover berths go on sale as current booking\. Check again then\.$/, "$1 का पहला चार्ट लगभग $2 पर बनेगा। तब कन्फर्म न हुए प्रतीक्षा सूची वाले ई-टिकट रद्द होकर पैसा लौटता है, और बची बर्थ करंट बुकिंग में बिकती हैं। तब फिर देखें।"],
    [/^The best is (\S+) (\S+) at (.+?)\. The tips below are your best moves\.$/, "सबसे अच्छा $1 $2 में $3 है। नीचे के सुझाव आपके सबसे अच्छे कदम हैं।"],
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
