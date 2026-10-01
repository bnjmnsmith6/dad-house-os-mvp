/* Dad's Second Home Checklist: CONTENT (the only file Product needs to edit)
 * Source: /workspace/research/checklist-item-evidence-v1.md (Researcher, final)
 * Fields per item:
 *   id       stable key (don't rename after launch: it's what the phone stores)
 *   name     shown to the dad (dads' own words where quotes give them)
 *   posts    posts naming it, EXCLUDING who-pays-only posts (evidence §3 "excl. cost-only")
 *   size     true = optional size field (clothes, shoes, diapers only)
 *   hint     true = small "often travels" hint. Product, Oct 1: ONLY School backpack and Prescribed medication.
 *   ages     optional: only show for these age bands (baby, little, school, teen). Omit = all ages.
 *   mainAges optional (main items only): show in the main list only if a kid is in one of these
 *            bands; otherwise (other fitting bands, or ages skipped) it moves under More ideas.
 *   note     optional short grey example line under the name
 *   seat     true = per-kid choice Car seat / Booster / Neither (stored on the phone only)
 *   src      quote ref (subreddit + post id) or "not evidenced" (data only; never shown in the UI)
 *   safety   n=1 item kept in main because leaving it out could hurt a kid (Product rule 2)
 * main = shown in the room. more = behind the collapsed "More ideas" row.
 */
window.CHECKLIST_CONTENT = {
  version: "content-v1.3-2026-10-01",
  ageBands: [
    { id: "baby", label: "Baby" },
    { id: "little", label: "Little (toddler to 5)" },
    { id: "school", label: "School-age" },
    { id: "teen", label: "Teen" }
  ],
  rooms: [
    {
      id: "bedroom", name: "Kid bedroom",
      main: [
        { id: "own_space", name: "Their own room or space", posts: 7, src: "r/DerechoGenial gvvden" },
        { id: "toys", name: "Toys", posts: 6, src: "r/Custody 15p63qn" },
        { id: "bed", name: "Bed", posts: 3, ages: ["little", "school", "teen"], src: "r/DivorcedDads 1wk1aj3" },
        { id: "crib", name: "Crib (safe place to sleep)", posts: 1, ages: ["baby"], safety: true, src: "r/SingleDads wfqdvu" }
      ],
      more: [
        { id: "bedding_same", name: "Bedding they're used to", posts: 1, src: "r/SingleDads o6mjr7" },
        { id: "temp_monitor", name: "Room temperature monitor", posts: 1, ages: ["baby"], src: "r/SingleDads o6mjr7" },
        { id: "nightlight", name: "Nightlight", posts: 0, src: "not evidenced" },
        { id: "comfort_item", name: "A comfort item or lovey", posts: 0, src: "not evidenced" },
        { id: "dresser", name: "Hangers or a dresser for their clothes", posts: 0, src: "not evidenced" }
      ]
    },
    {
      id: "bathroom", name: "Bathroom",
      main: [
        { id: "diapers", name: "Diapers", posts: 7, size: true, ages: ["baby", "little"], src: "r/SingleDads ybnq1a" },
        { id: "toothbrush", name: "Toothbrush", posts: 2, src: "r/SingleDads r5ockr" },
        { id: "soap", name: "Soap", posts: 2, src: "r/coparenting 1fr67qy" },
        { id: "bathroom_stuff", name: "Other bathroom stuff (toiletries)", posts: 3, src: "r/Divorce iozbxq" },
        { id: "pads", name: "Pads (if she's started her period)", posts: 3, ages: ["school", "teen"], mainAges: ["teen"], src: "r/SingleDads i72xng" }
      ],
      more: [
        { id: "wipes", name: "Wipes", posts: 1, ages: ["baby", "little"], src: "r/SingleDads 1tggnhn" },
        { id: "powder", name: "Powder", posts: 1, ages: ["baby", "little"], src: "r/SingleDads wfqdvu" },
        { id: "hairbrush", name: "Hairbrush, detangler, hair ties", posts: 0, src: "not evidenced" },
        { id: "towels", name: "Towels", posts: 0, src: "not evidenced" },
        { id: "sunscreen", name: "Sunscreen", posts: 0, src: "not evidenced" }
      ]
    },
    {
      id: "kitchen", name: "Kitchen",
      main: [
        { id: "snacks", name: "Snacks", posts: 4, src: "r/daddit 189soa1" },
        { id: "food", name: "Food they'll eat", note: "breakfast, a few dinners they like", posts: 3, src: "r/SingleDads 1koffd0" }
      ],
      more: [
        { id: "milk", name: "Milk for a baby", posts: 1, ages: ["baby"], src: "r/SingleDads o6mjr7" },
        { id: "kitchen_stuff", name: "Kitchen stuff", posts: 1, src: "r/SingleDads 14b184a" },
        { id: "wet_rag", name: "Wet rag by the sink for quick clean-ups", posts: 1, src: "r/SingleDads 1w7ppln" },
        { id: "plates_cups", name: "Kids' plates and cups", posts: 0, src: "not evidenced" }
      ]
    },
    {
      id: "clothes", name: "Clothes & shoes",
      main: [
        { id: "clothes", name: "Clothes", posts: 37, size: true, src: "r/mexico 1f2tpko; r/Divorce iozbxq" },
        { id: "shoes", name: "Shoes", posts: 12, size: true, src: "r/Divorce 1ub5jv4" },
        { id: "costume", name: "Recital or activity costume and shoes", posts: 2, src: "r/SingleDads 1phzo76" }
      ],
      more: [
        { id: "winter_gear", name: "Winter coat, rain coat, snow boots, snow pants", posts: 1, src: "r/coparenting 1fr67qy" },
        { id: "pajamas", name: "Pajamas (bed clothes)", posts: 1, src: "r/SingleDads o6mjr7" },
        { id: "socks", name: "Socks", posts: 1, src: "r/mexico 1f2tpko" },
        { id: "spare_underwear", name: "Extra underwear or shorts for school", posts: 1, src: "r/SingleDads 16ixwyr" }
      ]
    },
    {
      id: "school", name: "School",
      main: [
        { id: "backpack", name: "School backpack", posts: 4, hint: true, ages: ["school", "teen"], src: "r/Custody 1srqtxd" },
        { id: "school_supplies", name: "School supplies (pencils, glue sticks, markers)", posts: 7, ages: ["school", "teen"], src: "r/SingleDads 1eq03dh" },
        { id: "lunches", name: "School lunches or lunch account money", posts: 3, ages: ["school", "teen"], src: "r/Divorce 1bm3mps" }
      ],
      more: [
        { id: "homework", name: "Homework, notebooks, reading books, school laptop", posts: 1, ages: ["school", "teen"], src: "r/Custody wshiju" },
        { id: "pe_kit", name: "PE kit", posts: 1, ages: ["school", "teen"], src: "r/SingleDads 1lp94ec" },
        { id: "uniform", name: "School uniform", posts: 1, ages: ["school", "teen"], src: "r/SingleDads 1ejx3sd" },
        { id: "forms", name: "Signed school forms", posts: 1, ages: ["school", "teen"], src: "r/SingleDads 1p0prju" },
        { id: "water_bottle", name: "Water bottle", posts: 1, ages: ["school", "teen"], src: "r/coparenting 1fr67qy" },
        { id: "school_contacts", name: "School contact list", posts: 0, ages: ["school", "teen"], src: "not evidenced" }
      ]
    },
    {
      id: "medical", name: "Medical & documents",
      main: [
        { id: "medication", name: "Prescribed medication", posts: 1, hint: true, safety: true, src: "r/Custody 1r6up5b" },
        { id: "sick_day_meds", name: "Fever and pain medicine", posts: 1, safety: true, src: "r/SingleDads 61xow3" }
      ],
      more: [
        { id: "rx_card", name: "Health insurance / prescription card", posts: 1, src: "r/Custody 17opsme" },
        { id: "medical_papers", name: "Papers you need to get them medical care", posts: 1, src: "r/Desahogo2 1qtkhsg" },
        { id: "birth_cert", name: "Birth certificate (copy)", posts: 1, src: "r/SingleDads 1i9837j" },
        { id: "thermometer", name: "Thermometer and first-aid basics", posts: 0, src: "not evidenced" },
        { id: "allergy_card", name: "Allergy or medical info card", posts: 0, src: "not evidenced" }
      ]
    },
    {
      id: "other", name: "Other",
      main: [
        { id: "car_seat", name: "Car seat or booster", seat: true, posts: 2, ages: ["baby", "little", "school"], src: "r/SingleDads 61xow3" },
        { id: "stroller", name: "Pram / stroller", posts: 2, ages: ["baby", "little"], src: "r/SingleDads 61xow3" },
        { id: "furniture", name: "Furniture", posts: 2, src: "r/SingleDads 14b184a" }
      ],
      more: [
        { id: "laundry", name: "Laundry and stain products", posts: 1, src: "r/SingleDads 15tr6sd" },
        { id: "tablet", name: "Tablet with games and movies", posts: 1, src: "r/coparenting 137bo9c" },
        { id: "kid_phone", name: "Their phone and charger", posts: 1, ages: ["teen"], src: "r/Custody wshiju (charger: not evidenced, merged in v1.3)" }
      ]
    }
  ]
};
