"use strict";

/* Word on the Street -- bilingual layer (English / العربية). Zero dependency, same shape as theme.js:
   the chosen language is remembered in localStorage and applied to <html> before paint by a tiny inline
   <head> script on each page (sets lang + dir, so there is no left-to-right flash on an Arabic load).
   This file holds the string table, wires the language button, maps construct names, and re-renders.
     - T(key, vars)      look up a UI string for the current language; falls back to English, then the key.
     - cLabel(id, en)    the Arabic name for a construct from the glossary, else its English label.
     - cLabelBoth(id,en) Arabic name with the English original in parentheses (for the Index + detail).
     - applyI18n()       fill [data-i18n] / [data-i18n-html] / [data-i18n-aria] elements + <title>/<meta>.
   Pages with data-driven content set window.renderI18n; the button calls it after switching language. */

const STR = {
  en: {
    /* shared chrome */
    brand: "Word on the Street",
    standfirst: "Research trends across linguistics, applied linguistics, and language education, tracked weekly.",
    nav_front: "Front page", nav_index: "The Index", nav_slow: "The Slow Table", nav_niches: "Niches", nav_papers: "Papers", nav_methods: "About",
    switch_to_ar: "Switch to Arabic", switch_to_en: "Switch to English",
    theme_to_dark: "Switch to dark theme", theme_to_light: "Switch to light theme",
    updated_weekly: "Updated weekly.",
    dateline_provisional: "Updated weekly. {year} so far, provisional.",
    dateline_through: "Updated weekly. Through {year}.",
    footer_data: "Data from <a href=\"https://openalex.org\" rel=\"noopener\">OpenAlex</a>, CC0 metadata.",
    footer_nav: "<a href=\"index.html\">Front page</a> · <a href=\"explore.html\">The Index</a> · <a href=\"slow.html\">The Slow Table</a> · <a href=\"niches.html\">Niches</a> · <a href=\"papers.html\">Papers</a> · <a href=\"about.html\">About</a>",
    mt_note: "",
    doc_title_about: "About · Word on the Street",
    doc_desc_about: "How Word on the Street builds its numbers on research trends across linguistics, applied linguistics, and language education, what they can and cannot tell you, and how to download the dataset.",
    about_title: "About",
    about_standfirst: "How these numbers are built, and how to read them.",
    baseline: "Still building a baseline, so these are early signals.",
    doc_title_index: "Word on the Street · Research trends in linguistics",
    doc_desc_index: "What is rising and fading across linguistics, applied linguistics, sociolinguistics, psycholinguistics, translation, and language education. Research trends tracked every week, built from OpenAlex.",

    /* front page */
    kicker_default: "The fastest riser this year",
    kicker_so_far: "Fastest rising so far in {year}",
    kicker_in: "Fastest rising in {year}",
    kicker_back: "← Back to the fastest riser",
    loading: "Loading…",
    no_movers: "No clear movers yet.",
    warming: "Warming up. The first weekly snapshot appears here soon.",
    lede_headline: "This is the fastest-rising construct in language research in {curYear}, {sofar}. The figure below is its firm change through {refYear}, the last fully indexed year. Tap any name to trace its full path.",
    lede_sofar_yes: "already in about {n} papers so far",
    lede_sofar_no: "still gaining ground",
    lede_other_papers: "This construct was {dir} through {refYear}, in about {n} papers that year. Tap another name to compare.",
    lede_other_nopapers: "This construct was {dir} through {refYear}. Tap another name to compare.",
    dir_rising: "rising", dir_fading: "fading",
    ctx_change_through: "change through {year}",
    ctx_rising_sofar: "rising in {year} so far",
    na: "n/a",
    cover_cap: "Share of the field's output across the fully indexed years. Hover to read any year.",
    movers_in: "Movers in {year}", movers_this_year: "Movers this year",
    rising_col: "Rising", fading_col: "Fading",
    no_risers: "No clear risers yet.", no_decliners: "No clear decliners yet.",
    no_citations: "No citation data yet.", no_papers: "No recent papers found.",
    gaps_head: "Underserved niches",
    gaps_intro: "Constructs whose <span id=\"gaps-window\">2022 to 2024</span> papers were cited well above the field's rate, while the literature on them is still thin. That window ends two years back, so citations have had time to land. A pointer to where attention may be heading.",
    gaps_vol: "{n} papers, {cohort}",
    gaps_lift: "×{x} the field",
    gaps_cohort_fallback: "recent years",
    most_cited_head: "Most cited in the last two years",
    most_cited_by: "By OpenAlex citation count.",
    newest_head: "New this week",
    about_nums_head: "About these numbers",
    about_nums_links: "<a href=\"explore.html\">Browse all constructs</a> · Read the full <a href=\"about.html\">methodology and limits</a>. <span id=\"stats-inline\"></span>",
    stats_inline: "Tracking {works} works a year across {span}.",
    citations: "{n} citations", open_access: "open access",
    chart_over_time: "{label} over time",

    /* Papers page */
    doc_title_papers: "Papers · Word on the Street",
    doc_desc_papers: "The latest and most-cited work across linguistics, applied linguistics, and language education, from OpenAlex.",
    pp_title: "Papers",
    pp_standfirst: "The latest and most-cited work across the field's journals.",
    pp_newest_head: "Newest",
    pp_note_html: "Most-cited work of roughly the last two years, by OpenAlex citation count. <span id=\"as-of\"></span> Titles, authors, venues, and links only; full text lives at the source.",
    pp_as_of: "As of {date}.",

    /* Explore (the Index) */
    doc_title_explore: "Explore all constructs · Word on the Street",
    doc_desc_explore: "Browse and search every construct tracked by Word on the Street, by share of the field and recent direction, across linguistics, applied linguistics, and language education.",
    ex_title: "The Index",
    ex_standfirst: "Every construct we track, by share of the field and its recent direction.",
    ex_form_aria: "Filter and sort constructs",
    ex_search_aria: "Search construct names",
    ex_search_ph: "Search {n} constructs",
    ex_sort_label: "Sort",
    ex_sort_share_desc: "Share, high to low",
    ex_sort_growth_desc: "Change, biggest gain",
    ex_sort_growth_asc: "Change, biggest drop",
    ex_sort_name_asc: "Name, A to Z",
    ex_sort_name_desc: "Name, Z to A",
    ex_src_label: "Source",
    ex_src_all: "All", ex_src_openalex: "OpenAlex", ex_src_curated: "Curated",
    ex_dir_label: "Direction",
    ex_dir_all: "All", ex_dir_up: "Rising", ex_dir_down: "Fading",
    ex_reset: "Reset",
    ex_count_html: "<span id=\"shown\">0</span> of <span id=\"total\">0</span> constructs",
    ex_caption: "All constructs, by share of the field and recent change",
    ex_th_construct: "Construct", ex_th_share: "Share", ex_th_trend: "Trend", ex_th_change: "Change",
    ex_share_year: "Share ’{yy}",
    ex_empty_html: "No constructs match. <button type=\"reset\" form=\"ex-form\" class=\"linklike\">Reset filters.</button>",
    ex_note: "Change is the firm move from the prior year to the last complete year. Trend lines plot complete years only; the partly indexed current year is left out of every percentage.",
    ex_warming: "Warming up. The first snapshot appears here soon.",
    ex_src_curated_badge: "curated",
    spark_aria: "{label}, share {word} over the complete years",
    spark_down: "falling", spark_up: "rising", spark_flat: "roughly flat", spark_none: "change not firm",
    no_firm_change: "No firm change; too few papers",

    /* Niches (Underserved niches) */
    doc_title_niches: "Underserved niches · Word on the Street",
    doc_desc_niches: "Constructs cited well above the field's rate while the literature on them is still thin, ranked by early-citation lift, across linguistics, applied linguistics, and language education.",
    ni_standfirst: "Constructs cited well above the field's rate, while the literature on them is still thin.",
    ni_form_aria: "Filter and sort niches",
    ni_search_ph: "Search {n} niches",
    ni_sort_lift_desc: "Lift, high to low",
    ni_sort_vol_asc: "Papers, fewest first",
    ni_sort_vol_desc: "Papers, most first",
    ni_count_html: "<span id=\"shown\">0</span> of <span id=\"total\">0</span> niches",
    ni_caption: "Underserved niches, by early-citation lift versus the field",
    ni_th_lift: "vs field",
    ni_th_vol: "Cohort papers",
    ni_lift_val: "×{x}",
    ni_empty_html: "No niches match. <button type=\"reset\" form=\"ni-form\" class=\"linklike\">Reset.</button>",
    ni_see_all: "See all {n} niches →",

    /* The Slow Table (a decade of rank movement) */
    doc_title_slow: "The Slow Table · Word on the Street",
    doc_desc_slow: "A decade of rank movement across linguistics, applied linguistics, and language education: which constructs climbed or slipped in the field's pecking order from 2014 to 2025, measured in rank so the indexing tailwind cannot reach them.",
    slow_title: "The Slow Table",
    slow_standfirst: "How the field's pecking order has shifted over a decade. Each year, every construct is ranked by its share of the literature, and we trace who climbed and who slipped between 2014 and 2025.",
    slow_insight_html: "<strong>{n} of {total}</strong> constructs published a larger share of papers in {y1} than in {y0}, yet slipped down the order. Growth that loses ground.",
    slow_effn: "The field is slowly widening: among the {k} named constructs, the effective number of distinct lines of work rose from about {a} to about {b} across the decade, with the usual year-to-year wobble.",
    slow_reshuffle_head: "The pecking order, reshuffled",
    slow_reshuffle_sub: "The {k} named constructs, ranked against each other. Who overtook whom between {y0} and {y1}.",
    slow_climbed: "Climbed the order",
    slow_slipped: "Slipped down",
    slow_steady: "steady",
    slow_steady_title: "A steady move across the decade, year after year.",
    slow_ladder_head: "The full ladder",
    slow_ladder_sub: "All {n} constructs, by how far each moved in the field's overall order between {y0} and {y1}.",
    slow_arrived_head: "Arrived mid-decade",
    slow_arrived_sub: "Too new in {y0} to hold a decade-long position; shown at their {y1} rank, with the year each first appears.",
    slow_arrived_at: "rank {r} in {y1}, {n} papers",
    slow_th_r0: "Rank ’{yy0}",
    slow_th_r1: "Rank ’{yy1}",
    slow_th_move: "Move",
    slow_th_path: "Path",
    slow_th_real: "Real terms",
    slow_real_up: "gained share", slow_real_flat: "held ground", slow_real_down: "lost share",
    slow_dir_label: "Move",
    slow_dir_up: "Climbed", slow_dir_down: "Slipped", slow_dir_flat: "Held",
    slow_sort_move_desc: "Biggest climb", slow_sort_move_asc: "Biggest slip", slow_sort_rank: "Rank in ’{yy1}",
    slow_spark_aria: "{label}, rank {word} from {y0} to {y1}",
    slow_w_up: "climbing", slow_w_down: "slipping", slow_w_flat: "roughly steady",
    slow_note: "Ranks compare the constructs we track to one another, within each year. The current year is still indexing, so the table ends at the last complete year, {y1}.",

    /* Construct detail */
    doc_title_construct: "Construct · Word on the Street",
    doc_desc_construct: "A construct's share of the field over time, its recent change, and a path to the works behind the numbers.",
    c_doc_title: "{label} · Word on the Street",
    c_not_found: "Construct not found",
    c_not_found_title: "Not found · Word on the Street",
    c_not_found_body_html: "That construct is not in the index. <a href=\"explore.html\">Browse all constructs</a>.",
    prov_curated: "Curated coinage",
    prov_openalex: "OpenAlex topic keyphrase",
    c_kicker: "{prov} · ranked {rank} of {total} by {refYear} share",
    c_sf_none: "Tracked across the field; no firm year-over-year change yet.",
    c_sf_flat: "Little changed through {refYear}, the last fully indexed year.",
    c_sf_down: "Fading through {refYear}, the last fully indexed year.",
    c_sf_up: "Rising through {refYear}, the last fully indexed year.",
    c_lede_none: "{label} accounted for {share} of the field's output in {refYear}.",
    c_lede_flat: "{label} accounted for {share} of the field's output in {refYear}, little changed on the year before.",
    c_lede_move: "{label} accounted for {share} of the field's output in {refYear}, {updown} {moved} on the year before.",
    c_up: "up", c_down: "down",
    c_chglab_none: "share in {refYear}, no firm year-over-year yet",
    c_fact_share: "Share in {refYear}",
    c_fact_change: "Change vs {priorYear}",
    c_fact_rank: "Rank",
    c_fact_rank_suffix: "of {total} by {refYear} share",
    c_fact_matched: "Matched works, {refYear}",
    c_fact_source: "Source",
    c_fact_earlycite: "Early-citation rate",
    c_earlycite_dd: "×{lift} the field ({span})",
    c_provisional: "{year} is still indexing, so its share is inflated; it is left off the chart and these figures.",
    c_provisional_leader: " It is among the fastest risers so far in {year}, by rank; the size of that move is not yet firm.",
    c_papers_note: "{label} matched about {n} works in {refYear}. The full list lives on OpenAlex, scoped exactly as the counts here are built.",
    c_numbers_head: "The numbers",
    c_read_papers_head: "Read the papers",
    c_oa_link: "View these works on OpenAlex →",
    c_oa_note: "Opens OpenAlex filtered to the two linguistics subfields and matched on title and abstract, the same rule behind the counts here. Individual papers are not stored, so the live list will differ slightly as indexing continues.",
    c_about_nums_cov_html: "Trends are share of the field's output, ranked on the last complete year. Read the full <a href=\"about.html\">methodology and limits</a>.",

    coverage_note: "Every figure is each construct's share of the OpenAlex-indexed, mostly-English journal literature."
  },

  ar: {
    /* shared chrome */
    brand: "حديث الساعة",
    standfirst: "اتجاهات البحث في اللسانيات واللسانيات التطبيقية وتعليم اللغات، تُحدَّث أسبوعيًا.",
    nav_front: "الصفحة الأولى", nav_index: "الفهرس", nav_slow: "حركة المراتب", nav_niches: "ثغرات بحثية", nav_papers: "الأبحاث", nav_methods: "عن الموقع",
    switch_to_ar: "التبديل إلى العربية", switch_to_en: "التبديل إلى الإنجليزية",
    theme_to_dark: "التبديل إلى المظهر الداكن", theme_to_light: "التبديل إلى المظهر الفاتح",
    updated_weekly: "تُحدَّث أسبوعيًا.",
    dateline_provisional: "تُحدَّث أسبوعيًا. {year} حتى الآن، بيانات أوّلية.",
    dateline_through: "تُحدَّث أسبوعيًا. حتى {year}.",
    footer_data: "البيانات من <a href=\"https://openalex.org\" rel=\"noopener\">OpenAlex</a> بترخيص CC0.",
    footer_nav: "<a href=\"index.html\">الصفحة الأولى</a> · <a href=\"explore.html\">الفهرس</a> · <a href=\"slow.html\">حركة المراتب</a> · <a href=\"niches.html\">ثغرات بحثية</a> · <a href=\"papers.html\">الأبحاث</a> · <a href=\"about.html\">عن الموقع</a>",
    mt_note: "ترجمة عربية آليّة، قد تتخلّلها أخطاء.",
    doc_title_about: "عن الموقع · حديث الساعة",
    doc_desc_about: "كيف يبني «حديث الساعة» أرقامه عن اتجاهات البحث في اللسانيات واللسانيات التطبيقية وتعليم اللغات، وما تقوله هذه الأرقام وما لا تقوله، وكيف تنزّل مجموعة البيانات.",
    about_title: "عن الموقع",
    about_standfirst: "كيف تُبنى هذه الأرقام، وكيف تُقرأ.",
    baseline: "ما زلنا نبني خط الأساس، فهذه إشارات أوّلية.",
    doc_title_index: "حديث الساعة · اتجاهات البحث في اللسانيات",
    doc_desc_index: "ما الذي يصعد وما الذي يتراجع في اللسانيات واللسانيات التطبيقية وعلم اللغة الاجتماعي والنفسي والترجمة وتعليم اللغات. اتجاهات بحثية تُرصد أسبوعيًا، مبنية على بيانات OpenAlex.",

    /* front page */
    kicker_default: "الأسرع صعودًا هذا العام",
    kicker_so_far: "الأسرع صعودًا حتى الآن في {year}",
    kicker_in: "الأسرع صعودًا في {year}",
    kicker_back: "→ العودة إلى الأسرع صعودًا",
    loading: "جارٍ التحميل…",
    no_movers: "لا تحرّكات واضحة بعد.",
    warming: "نستعدّ للانطلاق. ستظهر أول لقطة أسبوعية هنا قريبًا.",
    lede_headline: "هذا أسرع المفاهيم صعودًا في أبحاث اللغة في {curYear}، {sofar}. والرقم أدناه هو تغيُّره المؤكَّد حتى {refYear}، آخر عام مكتمل الفهرسة. انقر أي اسم لتتبُّع مساره الكامل.",
    lede_sofar_yes: "وقد ورد في نحو {n} ورقة حتى الآن",
    lede_sofar_no: "وما يزال يكسب زخمًا",
    lede_other_papers: "كان هذا المفهوم {dir} حتى {refYear}، في نحو {n} ورقة ذلك العام. انقر اسمًا آخر للمقارنة.",
    lede_other_nopapers: "كان هذا المفهوم {dir} حتى {refYear}. انقر اسمًا آخر للمقارنة.",
    dir_rising: "في صعود", dir_fading: "في تراجع",
    ctx_change_through: "التغيُّر حتى {year}",
    ctx_rising_sofar: "في صعود في {year} حتى الآن",
    na: "غير متاح",
    cover_cap: "حصة المفهوم من إنتاج المجال عبر الأعوام المكتملة الفهرسة. مرِّر المؤشر لقراءة أي عام.",
    movers_in: "أبرز التحرّكات في {year}", movers_this_year: "أبرز التحرّكات هذا العام",
    rising_col: "في صعود", fading_col: "في تراجع",
    no_risers: "لا صاعدين واضحين بعد.", no_decliners: "لا متراجعين واضحين بعد.",
    no_citations: "لا بيانات اقتباس بعد.", no_papers: "لا أبحاث حديثة بعد.",
    gaps_head: "ثغرات بحثية",
    gaps_intro: "مفاهيم فاق معدّلُ اقتباس أبحاثها في <span id=\"gaps-window\">2022 إلى 2024</span> معدّلَ المجال بكثير، بينما ما زال ما كُتب عنها قليلًا. تنتهي تلك الفترة قبل عامين، فأتيح للاقتباسات وقتٌ كافٍ لتظهر. إشارة إلى وجهة الاهتمام المحتملة.",
    gaps_vol: "{n} ورقة، {cohort}",
    gaps_lift: "{x}× معدّل المجال",
    gaps_cohort_fallback: "الأعوام الأخيرة",
    most_cited_head: "الأكثر اقتباسًا في العامين الأخيرين",
    most_cited_by: "وفق عدد الاقتباسات في OpenAlex.",
    newest_head: "جديد هذا الأسبوع",
    about_nums_head: "عن هذه الأرقام",
    about_nums_links: "<a href=\"explore.html\">تصفّح كل المفاهيم</a> · اقرأ <a href=\"about.html\">المنهجية الكاملة وحدودها</a>. <span id=\"stats-inline\"></span>",
    stats_inline: "نتتبّع {works} عمل سنويًا عبر {span}.",
    citations: "{n} اقتباس", open_access: "وصول مفتوح",
    chart_over_time: "{label} عبر الزمن",

    /* Papers page */
    doc_title_papers: "الأبحاث · حديث الساعة",
    doc_desc_papers: "أحدث الأعمال وأكثرها اقتباسًا في اللسانيات واللسانيات التطبيقية وتعليم اللغات، من OpenAlex.",
    pp_title: "الأبحاث",
    pp_standfirst: "أحدث الأعمال وأكثرها اقتباسًا في دوريات المجال.",
    pp_newest_head: "الأحدث",
    pp_note_html: "أكثر الأعمال اقتباسًا في العامين الأخيرين تقريبًا، وفق عدد الاقتباسات في OpenAlex. <span id=\"as-of\"></span> العناوين والمؤلفون والأوعية والروابط فقط؛ والنص الكامل عند المصدر.",
    pp_as_of: "حتى {date}.",

    /* Explore (الفهرس) */
    doc_title_explore: "الفهرس · حديث الساعة",
    doc_desc_explore: "تصفّح وابحث في كل مفهوم يتتبّعه حديث الساعة، حسب الحصة من المجال والاتجاه الأخير، عبر اللسانيات واللسانيات التطبيقية وتعليم اللغات.",
    ex_title: "الفهرس",
    ex_standfirst: "كل مفهوم نتتبّعه، حسب حصته من المجال واتجاهه الأخير.",
    ex_form_aria: "تصفية المفاهيم وترتيبها",
    ex_search_aria: "ابحث في أسماء المفاهيم",
    ex_search_ph: "ابحث في {n} مفهوم",
    ex_sort_label: "الترتيب",
    ex_sort_share_desc: "الحصة، من الأعلى إلى الأدنى",
    ex_sort_growth_desc: "التغيّر، الأكبر صعودًا",
    ex_sort_growth_asc: "التغيّر، الأكبر هبوطًا",
    ex_sort_name_asc: "الاسم، أ إلى ي",
    ex_sort_name_desc: "الاسم، ي إلى أ",
    ex_src_label: "المصدر",
    ex_src_all: "الكل", ex_src_openalex: "OpenAlex", ex_src_curated: "مُنسّقة",
    ex_dir_label: "الاتجاه",
    ex_dir_all: "الكل", ex_dir_up: "في صعود", ex_dir_down: "في تراجع",
    ex_reset: "إعادة ضبط",
    ex_count_html: "<span id=\"shown\">0</span> من <span id=\"total\">0</span> مفهوم",
    ex_caption: "كل المفاهيم، حسب الحصة من المجال والتغيّر الأخير",
    ex_th_construct: "المفهوم", ex_th_share: "الحصة", ex_th_trend: "الاتجاه", ex_th_change: "التغيّر",
    ex_share_year: "حصة ’{yy}",
    ex_empty_html: "لا مفاهيم مطابِقة. <button type=\"reset\" form=\"ex-form\" class=\"linklike\">إعادة الضبط.</button>",
    ex_note: "التغيّر هو الحركة المؤكَّدة من العام السابق إلى آخر عام مكتمل. وخطوط الاتجاه ترسم الأعوام المكتملة فقط؛ والعام الجاري المفهرَس جزئيًا مستبعَد من كل نسبة.",
    ex_warming: "نستعدّ للانطلاق. ستظهر أول لقطة هنا قريبًا.",
    ex_src_curated_badge: "مُنسّقة",
    spark_aria: "{label}، الحصة {word} عبر الأعوام المكتملة",
    spark_down: "في هبوط", spark_up: "في صعود", spark_flat: "شبه ثابتة", spark_none: "غير مؤكَّدة",
    no_firm_change: "لا تغيّر مؤكَّد؛ الأوراق قليلة جدًا",

    /* Niches (ثغرات بحثية) */
    doc_title_niches: "ثغرات بحثية · حديث الساعة",
    doc_desc_niches: "مفاهيم تُقتبَس فوق معدّل المجال بكثير بينما ما زال ما كُتب عنها قليلًا، مرتَّبة حسب الاقتباس المبكّر، عبر اللسانيات واللسانيات التطبيقية وتعليم اللغات.",
    ni_standfirst: "مفاهيم تُقتبَس فوق معدّل المجال بكثير، بينما ما زال ما كُتب عنها قليلًا.",
    ni_form_aria: "تصفية الثغرات وترتيبها",
    ni_search_ph: "ابحث في {n} ثغرة",
    ni_sort_lift_desc: "مقابل المجال، من الأعلى",
    ni_sort_vol_asc: "الأوراق، الأقل أولًا",
    ni_sort_vol_desc: "الأوراق، الأكثر أولًا",
    ni_count_html: "<span id=\"shown\">0</span> من <span id=\"total\">0</span> ثغرة",
    ni_caption: "الثغرات البحثية، حسب الاقتباس المبكّر مقابل المجال",
    ni_th_lift: "مقابل المجال",
    ni_th_vol: "أوراق الفترة",
    ni_lift_val: "{x}×",
    ni_empty_html: "لا ثغرات مطابِقة. <button type=\"reset\" form=\"ni-form\" class=\"linklike\">إعادة الضبط.</button>",
    ni_see_all: "اعرض كل الثغرات ({n}) ←",

    /* The Slow Table (حركة المراتب عبر عقد) */
    doc_title_slow: "الجدول البطيء · حديث الساعة",
    doc_desc_slow: "عقدٌ من حركة المراتب في اللسانيات واللسانيات التطبيقية وتعليم اللغات: أيُّ المفاهيم صعد أو تراجع في ترتيب المجال من 2014 إلى 2025، مقيسًا بالمرتبة كي لا يطاله أثر الفهرسة.",
    slow_title: "الجدول البطيء",
    slow_standfirst: "كيف تبدّل ترتيب المجال عبر عقد. في كل عام يُرتَّب كل مفهوم بحسب حصته من الأدبيات، ونتتبّع مَن صعد ومَن تراجع بين 2014 و2025.",
    slow_insight_html: "<strong>{n} من {total}</strong> مفهومًا نشرت حصة أكبر من الأوراق في {y1} مقارنةً بـ{y0}، ومع ذلك تراجعت في الترتيب. نموٌّ يخسر موقعه.",
    slow_effn: "يتّسع المجال ببطء: بين المفاهيم المسمّاة الـ{k}، ارتفع العدد الفعلي لخطوط العمل المتمايزة من نحو {a} إلى نحو {b} عبر العقد، مع التذبذب المعتاد من عام لآخر.",
    slow_reshuffle_head: "إعادة ترتيب المراتب",
    slow_reshuffle_sub: "المفاهيم المسمّاة الـ{k}، مرتَّبة بعضها مقابل بعض. مَن تجاوز مَن بين {y0} و{y1}.",
    slow_climbed: "صعدوا في الترتيب",
    slow_slipped: "تراجعوا",
    slow_steady: "ثابت",
    slow_steady_title: "حركة ثابتة عبر العقد، عامًا بعد عام.",
    slow_ladder_head: "السلّم الكامل",
    slow_ladder_sub: "كل المفاهيم الـ{n}، حسب مقدار حركة كلٍّ منها في ترتيب المجال العام بين {y0} و{y1}.",
    slow_arrived_head: "وصلوا في منتصف العقد",
    slow_arrived_sub: "أحدثُ من أن تكون لها مرتبة على مدى العقد في {y0}؛ تظهر بمرتبتها في {y1}، مع عام أوّل ظهور.",
    slow_arrived_at: "المرتبة {r} في {y1}، {n} ورقة",
    slow_th_r0: "مرتبة ’{yy0}",
    slow_th_r1: "مرتبة ’{yy1}",
    slow_th_move: "الحركة",
    slow_th_path: "المسار",
    slow_th_real: "بالقيمة الحقيقية",
    slow_real_up: "كسبت حصة", slow_real_flat: "حافظت", slow_real_down: "خسرت حصة",
    slow_dir_label: "الحركة",
    slow_dir_up: "صاعد", slow_dir_down: "متراجع", slow_dir_flat: "ثابت",
    slow_sort_move_desc: "الأكبر صعودًا", slow_sort_move_asc: "الأكبر تراجعًا", slow_sort_rank: "المرتبة في ’{yy1}",
    slow_spark_aria: "{label}، المرتبة {word} من {y0} إلى {y1}",
    slow_w_up: "في صعود", slow_w_down: "في تراجع", slow_w_flat: "شبه ثابتة",
    slow_note: "تقارن المراتبُ المفاهيمَ التي نتتبّعها بعضها ببعض، داخل كل عام. والعام الجاري ما زال قيد الفهرسة، فينتهي الجدول عند آخر عام مكتمل، {y1}.",

    /* Construct detail */
    doc_title_construct: "مفهوم · حديث الساعة",
    doc_desc_construct: "حصة المفهوم من المجال عبر الزمن، وتغيّره الأخير، وطريق إلى الأعمال خلف الأرقام.",
    c_doc_title: "{label} · حديث الساعة",
    c_not_found: "المفهوم غير موجود",
    c_not_found_title: "غير موجود · حديث الساعة",
    c_not_found_body_html: "هذا المفهوم ليس في الفهرس. <a href=\"explore.html\">تصفّح كل المفاهيم</a>.",
    prov_curated: "مصطلح مُنسّق",
    prov_openalex: "عبارة موضوعية من OpenAlex",
    c_kicker: "{prov} · المرتبة {rank} من {total} حسب حصة {refYear}",
    c_sf_none: "متتبَّع في المجال؛ لا تغيّر سنوي مؤكَّد بعد.",
    c_sf_flat: "تغيّر طفيف حتى {refYear}، آخر عام مكتمل الفهرسة.",
    c_sf_down: "في تراجع حتى {refYear}، آخر عام مكتمل الفهرسة.",
    c_sf_up: "في صعود حتى {refYear}، آخر عام مكتمل الفهرسة.",
    c_lede_none: "شكّل {label} {share} من إنتاج المجال في {refYear}.",
    c_lede_flat: "شكّل {label} {share} من إنتاج المجال في {refYear}، بتغيّر طفيف عن العام السابق.",
    c_lede_move: "شكّل {label} {share} من إنتاج المجال في {refYear}، {updown} بنسبة {moved} عن العام السابق.",
    c_up: "صاعدًا", c_down: "هابطًا",
    c_chglab_none: "الحصة في {refYear}، لا تغيّر سنوي مؤكَّد بعد",
    c_fact_share: "الحصة في {refYear}",
    c_fact_change: "التغيّر مقابل {priorYear}",
    c_fact_rank: "المرتبة",
    c_fact_rank_suffix: "من {total} حسب حصة {refYear}",
    c_fact_matched: "الأعمال المطابِقة، {refYear}",
    c_fact_source: "المصدر",
    c_fact_earlycite: "معدّل الاقتباس المبكّر",
    c_earlycite_dd: "{lift}× معدّل المجال ({span})",
    c_provisional: "{year} لا يزال قيد الفهرسة، فحصته منتفخة؛ وهو مستبعَد من الرسم ومن هذه الأرقام.",
    c_provisional_leader: " وهو من أسرع الصاعدين حتى الآن في {year} بالترتيب؛ لكن حجم تلك الحركة غير مؤكَّد بعد.",
    c_papers_note: "طابَق {label} نحو {n} عمل في {refYear}. والقائمة الكاملة على OpenAlex، بالنطاق نفسه الذي تُبنى به الأعداد هنا.",
    c_numbers_head: "الأرقام",
    c_read_papers_head: "اطّلع على الأبحاث",
    c_oa_link: "اعرض هذه الأعمال على OpenAlex ←",
    c_oa_note: "يفتح OpenAlex مُرشَّحًا على حقلَي اللسانيات الفرعيين ومطابَقًا على العنوان والملخّص، وهي القاعدة نفسها خلف الأعداد هنا. ولا تُخزَّن الأوراق فُرادى، فالقائمة الحيّة ستختلف قليلًا مع استمرار الفهرسة.",
    c_about_nums_cov_html: "الاتجاهات حصةٌ من إنتاج المجال، مرتَّبة على آخر عام مكتمل. اقرأ <a href=\"about.html\">المنهجية الكاملة وحدودها</a>.",

    coverage_note: "كل رقم هو حصّة المفهوم من أدبيات الدوريات المفهرَسة في OpenAlex، الغالبة الإنجليزية."
  }
};

function curLang() { try { return localStorage.getItem("lang") === "ar" ? "ar" : "en"; } catch (e) { return "en"; } }

function T(key, vars) {
  var lang = curLang();
  var s = (STR[lang] && STR[lang][key]);
  if (s == null) s = (STR.en[key] != null ? STR.en[key] : key);
  if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ""; });
  return s;
}

/* ---- construct glossary (Arabic names), loaded on demand; English fallback for anything unmapped ---- */
var _glossary = null;
async function loadGlossary() {
  if (_glossary) return _glossary;
  try {
    var r = await fetch("data/constructs_ar.json", { cache: "no-store" });
    if (r.ok) { var j = await r.json(); _glossary = (j && j.labels) ? j.labels : (j || {}); }
  } catch (e) { /* keep null -> treated as empty below */ }
  if (!_glossary) _glossary = {};
  return _glossary;
}
function cLabel(id, en) {
  if (curLang() === "ar" && _glossary && _glossary[id]) return _glossary[id];
  return en;
}
function cLabelBoth(id, en) {
  if (curLang() === "ar" && _glossary && _glossary[id]) return _glossary[id] + " (" + en + ")";
  return en;
}

/* ---- fill static markup from the table ---- */
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(function (el) { var v = T(el.getAttribute("data-i18n")); if (v != null) el.textContent = v; });
  document.querySelectorAll("[data-i18n-html]").forEach(function (el) { var v = T(el.getAttribute("data-i18n-html")); if (v != null) el.innerHTML = v; });
  document.querySelectorAll("[data-i18n-aria]").forEach(function (el) { var v = T(el.getAttribute("data-i18n-aria")); if (v != null) el.setAttribute("aria-label", v); });
  var d = document.documentElement;
  var tk = d.getAttribute("data-i18n-title"); if (tk) { var tv = T(tk); if (tv) document.title = tv; }
  var dk = d.getAttribute("data-i18n-desc"); if (dk) { var dv = T(dk); if (dv) { var m = document.querySelector('meta[name="description"]'); if (m) m.setAttribute("content", dv); } }
}

/* ---- language button + switching ---- */
function updateLangButton() {
  var btn = document.getElementById("lang-toggle"); if (!btn) return;
  var lang = curLang();
  btn.textContent = lang === "ar" ? "EN" : "ع";              // the button shows the OTHER language
  btn.setAttribute("aria-label", lang === "ar" ? STR.ar.switch_to_en : STR.en.switch_to_ar);
}
function setLang(lang) {
  lang = lang === "ar" ? "ar" : "en";
  try { localStorage.setItem("lang", lang); } catch (e) { /* storage may be blocked */ }
  var d = document.documentElement;
  d.lang = lang; d.dir = lang === "ar" ? "rtl" : "ltr";
  updateLangButton();
  applyI18n();
  if (typeof window.refreshThemeLabel === "function") window.refreshThemeLabel();
  if (typeof window.renderI18n === "function") window.renderI18n();
}
function initI18n() {
  updateLangButton();
  var btn = document.getElementById("lang-toggle");
  if (btn) btn.addEventListener("click", function () { setLang(curLang() === "ar" ? "en" : "ar"); });
  applyI18n();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initI18n);
else initI18n();
