const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function encodeSvg(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createThumbnail(item) {
  const [colorA, colorB, colorC, colorD] = item.palette;
  const common = `
    <defs>
      <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="${colorA}" />
        <stop offset="100%" stop-color="${colorB}" />
      </linearGradient>
      <linearGradient id="ground" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${colorC}" />
        <stop offset="100%" stop-color="${colorD}" />
      </linearGradient>
      <filter id="soft">
        <feGaussianBlur stdDeviation="14" />
      </filter>
    </defs>
  `;

  const sceneMap = {
    moonrise: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <circle cx="740" cy="170" r="48" fill="rgba(255,255,255,0.8)" />
      <g fill="rgba(255,255,255,0.12)" filter="url(#soft)">
        <ellipse cx="660" cy="180" rx="220" ry="80" />
        <ellipse cx="420" cy="220" rx="260" ry="96" />
      </g>
      <path d="M0 720 C160 640 280 680 420 710 C550 735 740 660 890 705 C1000 735 1100 705 1200 725 L1200 900 L0 900 Z" fill="url(#ground)" />
      <path d="M760 780 C790 640 900 620 936 780 Z" fill="#1b2f28" />
      <path d="M860 790 C888 650 992 640 1020 790 Z" fill="#21372f" />
      <path d="M905 585 C850 650 870 720 905 792 C940 720 958 652 905 585 Z" fill="#23392f" />
      <g fill="#233238">
        <rect x="110" y="690" width="110" height="100" rx="8" />
        <rect x="240" y="650" width="136" height="138" rx="8" />
      </g>
    `,
    bookstore: `
      <rect width="1200" height="900" fill="#362618" />
      <rect x="0" y="0" width="1200" height="150" fill="${colorA}" />
      <rect x="80" y="180" width="260" height="590" rx="18" fill="#5a3419" />
      <rect x="390" y="120" width="310" height="660" rx="18" fill="#72421f" />
      <rect x="760" y="170" width="300" height="610" rx="18" fill="#4b2b18" />
      <path d="M0 830 L1200 830 L1200 900 L0 900 Z" fill="#241712" />
      <g>
        <rect x="116" y="220" width="188" height="26" fill="#dd8458" />
        <rect x="116" y="278" width="188" height="24" fill="#f5c16d" />
        <rect x="116" y="336" width="188" height="28" fill="#9fd5cb" />
        <rect x="430" y="176" width="228" height="24" fill="#f2a76a" />
        <rect x="430" y="234" width="228" height="28" fill="#d9673b" />
        <rect x="800" y="226" width="224" height="26" fill="#f6c25d" />
        <rect x="800" y="288" width="224" height="26" fill="#b45d2f" />
      </g>
      <path d="M556 310 L680 310 L760 900 L470 900 Z" fill="rgba(255,224,184,0.22)" />
    `,
    blossomStreet: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <path d="M0 780 C160 720 280 740 420 760 C600 790 880 710 1200 760 L1200 900 L0 900 Z" fill="url(#ground)" />
      <rect x="520" y="80" width="26" height="620" rx="14" fill="#534841" />
      <rect x="270" y="120" width="24" height="560" rx="14" fill="#57463f" />
      <g fill="${colorC}">
        <circle cx="542" cy="160" r="104" />
        <circle cx="298" cy="206" r="96" />
      </g>
      <g fill="#d7b8d8">
        <circle cx="510" cy="126" r="24" />
        <circle cx="600" cy="200" r="20" />
        <circle cx="268" cy="176" r="22" />
        <circle cx="354" cy="242" r="20" />
      </g>
      <path d="M420 900 L690 900 L612 540 L498 540 Z" fill="rgba(24,28,36,0.76)" />
      <rect x="540" y="402" width="28" height="140" rx="14" fill="#d8d2ad" />
    `,
    lilyPond: `
      <rect width="1200" height="900" fill="#243128" />
      <rect x="0" y="0" width="1200" height="900" fill="url(#sky)" opacity="0.36" />
      <g>
        <ellipse cx="210" cy="190" rx="136" ry="74" fill="#59753d" />
        <ellipse cx="430" cy="250" rx="150" ry="86" fill="#4d7035" />
        <ellipse cx="740" cy="180" rx="142" ry="76" fill="#5c8142" />
        <ellipse cx="1010" cy="260" rx="162" ry="90" fill="#51733a" />
        <ellipse cx="298" cy="508" rx="146" ry="80" fill="#5e7a40" />
        <ellipse cx="612" cy="450" rx="168" ry="94" fill="#648448" />
        <ellipse cx="926" cy="538" rx="150" ry="84" fill="#57753c" />
      </g>
      <g fill="#f4a0b9">
        <circle cx="370" cy="244" r="22" />
        <circle cx="726" cy="160" r="24" />
        <circle cx="620" cy="458" r="23" />
        <circle cx="934" cy="520" r="21" />
      </g>
      <rect x="740" y="440" width="236" height="116" rx="20" fill="rgba(210,65,65,0.78)" transform="rotate(-13 858 498)" />
    `,
    architecture: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <rect x="0" y="0" width="1200" height="230" fill="rgba(255,255,255,0.04)" />
      <rect x="160" y="140" width="860" height="640" rx="18" fill="#c2c0bb" />
      <g fill="#8e8e90">
        <rect x="250" y="230" width="240" height="160" rx="8" />
        <rect x="538" y="230" width="240" height="160" rx="8" />
        <rect x="250" y="434" width="240" height="160" rx="8" />
        <rect x="538" y="434" width="240" height="160" rx="8" />
      </g>
      <g fill="rgba(186,170,220,0.55)">
        <circle cx="156" cy="520" r="86" />
        <circle cx="214" cy="442" r="66" />
      </g>
    `,
    catWindow: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <rect x="120" y="116" width="960" height="660" rx="28" fill="#40352e" />
      <rect x="180" y="168" width="840" height="556" rx="18" fill="#a8c5b0" />
      <path d="M702 614 C736 492 846 504 860 648 C796 670 734 660 702 614 Z" fill="#2a241f" />
      <circle cx="784" cy="612" r="90" fill="#211d19" opacity="0.9" />
      <circle cx="754" cy="580" r="12" fill="#f9e6b3" />
      <circle cx="818" cy="580" r="12" fill="#f9e6b3" />
      <rect x="80" y="724" width="1040" height="120" fill="#5f4c3c" />
    `,
    coast: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <path d="M0 526 C200 486 360 520 520 540 C700 566 920 490 1200 520 L1200 900 L0 900 Z" fill="#2d5e73" />
      <path d="M0 650 C210 608 430 642 620 664 C830 690 1010 640 1200 652 L1200 900 L0 900 Z" fill="#20404c" />
      <circle cx="896" cy="238" r="58" fill="#ffd694" />
      <path d="M116 744 L244 640 L322 744 Z" fill="#6c5143" />
      <path d="M266 774 L410 624 L516 774 Z" fill="#533f34" />
    `,
    market: `
      <rect width="1200" height="900" fill="#291811" />
      <rect width="1200" height="400" fill="url(#sky)" />
      <path d="M0 690 L240 506 L410 690 Z" fill="#5d4031" />
      <path d="M290 706 L520 454 L756 706 Z" fill="#4b3026" />
      <path d="M700 710 L980 506 L1200 710 Z" fill="#6d4938" />
      <g fill="#f0aa3c">
        <circle cx="266" cy="388" r="32" />
        <circle cx="624" cy="348" r="34" />
        <circle cx="902" cy="404" r="28" />
      </g>
    `,
    document: `
      <rect width="1200" height="900" fill="#f0eadf" />
      <rect x="182" y="84" width="836" height="728" rx="24" fill="#fbf6ee" stroke="#d8d0c3" stroke-width="6" />
      <rect x="260" y="190" width="680" height="22" rx="11" fill="#cabfae" />
      <rect x="260" y="252" width="620" height="20" rx="10" fill="#d8cfbf" />
      <rect x="260" y="314" width="700" height="20" rx="10" fill="#d7cec0" />
      <rect x="260" y="430" width="240" height="160" rx="18" fill="#d8c2ad" />
      <rect x="536" y="430" width="300" height="22" rx="11" fill="#c7bdaf" />
      <rect x="536" y="488" width="248" height="20" rx="10" fill="#cfc4b5" />
      <rect x="536" y="546" width="274" height="20" rx="10" fill="#d4c8ba" />
    `,
    screen: `
      <rect width="1200" height="900" fill="#10141c" />
      <rect x="110" y="110" width="980" height="680" rx="28" fill="#1a2230" />
      <rect x="176" y="188" width="394" height="420" rx="20" fill="#213049" />
      <rect x="624" y="188" width="322" height="116" rx="18" fill="#273650" />
      <rect x="624" y="334" width="322" height="116" rx="18" fill="#2f4060" />
      <rect x="624" y="480" width="322" height="116" rx="18" fill="#374a70" />
      <circle cx="272" cy="256" r="22" fill="#73d9c3" />
      <rect x="260" y="668" width="660" height="28" rx="14" fill="#2b3545" />
    `,
    road: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <path d="M0 780 C220 700 422 742 642 762 C858 780 1030 722 1200 746 L1200 900 L0 900 Z" fill="#25343d" />
      <path d="M420 900 L580 900 L670 420 L500 420 Z" fill="#161b1f" />
      <rect x="548" y="470" width="16" height="70" rx="8" fill="#f7ddb7" />
      <rect x="548" y="578" width="16" height="70" rx="8" fill="#f7ddb7" />
      <rect x="548" y="686" width="16" height="70" rx="8" fill="#f7ddb7" />
      <circle cx="334" cy="628" r="46" fill="#f5c986" opacity="0.4" />
      <circle cx="862" cy="618" r="54" fill="#f5c986" opacity="0.25" />
    `,
    portrait: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <circle cx="612" cy="304" r="126" fill="#efd4bc" />
      <rect x="450" y="420" width="320" height="324" rx="140" fill="#342a28" />
      <path d="M460 318 C490 150 736 154 760 334 C700 254 530 250 460 318 Z" fill="#241d1b" />
      <rect x="520" y="742" width="186" height="138" rx="40" fill="#6c7286" />
    `,
    fireworks: `
      <rect width="1200" height="900" fill="#0e1320" />
      <g stroke="#f8d08a" stroke-width="10" stroke-linecap="round">
        <line x1="340" y1="150" x2="340" y2="290" />
        <line x1="270" y1="220" x2="410" y2="220" />
        <line x1="292" y1="172" x2="388" y2="268" />
        <line x1="388" y1="172" x2="292" y2="268" />
      </g>
      <g stroke="#d9f6ff" stroke-width="9" stroke-linecap="round">
        <line x1="860" y1="210" x2="860" y2="336" />
        <line x1="796" y1="274" x2="924" y2="274" />
        <line x1="812" y1="226" x2="910" y2="322" />
        <line x1="910" y1="226" x2="812" y2="322" />
      </g>
      <path d="M0 790 C180 730 340 760 540 780 C780 806 970 742 1200 772 L1200 900 L0 900 Z" fill="#171d28" />
    `,
    mountain: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <path d="M0 640 L242 340 L458 640 Z" fill="#556271" />
      <path d="M286 670 L612 248 L912 670 Z" fill="#45515e" />
      <path d="M656 682 L934 386 L1200 682 Z" fill="#394451" />
      <path d="M0 700 C220 680 500 710 700 730 C900 750 1040 722 1200 734 L1200 900 L0 900 Z" fill="#202933" />
      <path d="M498 392 L612 248 L706 392 Z" fill="#dce7ef" opacity="0.9" />
    `,
    coffee: `
      <rect width="1200" height="900" fill="#2b1d17" />
      <rect x="0" y="0" width="1200" height="900" fill="url(#sky)" opacity="0.22" />
      <rect x="160" y="140" width="880" height="620" rx="36" fill="#694230" />
      <ellipse cx="612" cy="448" rx="246" ry="188" fill="#f1e5d7" />
      <ellipse cx="612" cy="450" rx="174" ry="126" fill="#6a4737" />
      <path d="M860 414 C930 430 938 542 868 568" fill="none" stroke="#f1e5d7" stroke-width="34" stroke-linecap="round" />
    `,
    beach: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <path d="M0 540 C250 498 420 546 650 566 C860 586 1020 556 1200 520 L1200 900 L0 900 Z" fill="#2a6a7d" />
      <path d="M0 670 C250 620 460 658 712 688 C920 712 1040 690 1200 674 L1200 900 L0 900 Z" fill="#ebc896" />
      <circle cx="958" cy="178" r="70" fill="#ffd68b" />
    `,
    gallery: `
      <rect width="1200" height="900" fill="#19171c" />
      <rect x="120" y="110" width="960" height="680" rx="32" fill="#262330" />
      <rect x="212" y="194" width="218" height="158" rx="18" fill="#45516b" />
      <rect x="490" y="194" width="214" height="158" rx="18" fill="#5f4867" />
      <rect x="762" y="194" width="226" height="158" rx="18" fill="#3c5969" />
      <rect x="212" y="418" width="340" height="228" rx="18" fill="#66513f" />
      <rect x="612" y="418" width="376" height="228" rx="18" fill="#2e3944" />
    `,
    harbor: `
      <rect width="1200" height="900" fill="url(#sky)" />
      <path d="M0 590 C240 560 420 596 676 620 C910 644 1060 626 1200 612 L1200 900 L0 900 Z" fill="#285569" />
      <g fill="#1e2a36">
        <rect x="160" y="480" width="110" height="180" />
        <rect x="296" y="420" width="134" height="240" />
        <rect x="860" y="460" width="154" height="200" />
      </g>
      <circle cx="854" cy="210" r="60" fill="#ffd59b" opacity="0.94" />
    `
  };

  const overlay = item.type === 'video'
    ? '<circle cx="1044" cy="150" r="62" fill="rgba(12,16,24,0.56)" /><path d="M1022 114 L1082 150 L1022 186 Z" fill="#ffffff" />'
    : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="${item.album}">
      ${common}
      ${sceneMap[item.scene] || sceneMap.harbor}
      ${overlay}
    </svg>
  `;

  return encodeSvg(svg);
}

const rawItems = [
  { id: 'media-001', type: 'photo', takenAt: '2026-04-05T19:18:00', width: 1512, height: 1134, album: 'Campus Evenings', tags: ['night', 'campus', 'palms'], location: 'Guangzhou', favorite: true, personLabels: [], scene: 'moonrise', palette: ['#182435', '#5c6a7a', '#0d1319', '#1c242c'] },
  { id: 'media-002', type: 'photo', takenAt: '2026-04-05T16:36:00', width: 1472, height: 1104, album: 'City Weekends', tags: ['books', 'interior'], location: 'Tianhe, Guangzhou', favorite: false, personLabels: ['Milo'], scene: 'bookstore', palette: ['#2a2018', '#7a4a28', '#5b351d', '#241612'] },
  { id: 'media-003', type: 'photo', takenAt: '2026-04-05T07:42:00', width: 1480, height: 1110, album: 'Morning Walks', tags: ['spring', 'trees'], location: 'Guangzhou University Town', favorite: true, personLabels: [], scene: 'blossomStreet', palette: ['#8a8d8b', '#d7c8b0', '#655f79', '#262f37'] },
  { id: 'media-004', type: 'photo', takenAt: '2026-04-04T15:26:00', width: 1488, height: 1116, album: 'Botanical Notes', tags: ['flowers', 'water'], location: 'South China Botanical Garden', favorite: false, personLabels: [], scene: 'lilyPond', palette: ['#2f3b2d', '#69824d', '#4c6d34', '#273224'] },
  { id: 'media-005', type: 'photo', takenAt: '2026-04-04T09:32:00', width: 1400, height: 1180, album: 'Campus Details', tags: ['building', 'spring'], location: 'Guangzhou', favorite: false, personLabels: [], scene: 'architecture', palette: ['#b7b9bf', '#d8d9db', '#6f7987', '#434d59'] },
  { id: 'media-006', type: 'video', takenAt: '2026-04-03T22:11:00', width: 1080, height: 1920, album: 'Home Clips', tags: ['cat', 'home'], location: 'Guangzhou', favorite: true, personLabels: ['Pepper'], scene: 'catWindow', palette: ['#7ca08b', '#c7d9cd', '#54463c', '#241d19'] },
  { id: 'media-007', type: 'photo', takenAt: '2026-04-03T18:54:00', width: 1600, height: 900, album: 'Blue Hour', tags: ['sea', 'sunset'], location: 'Shenzhen Bay', favorite: true, personLabels: [], scene: 'coast', palette: ['#7ca0c6', '#ffb27a', '#2f6073', '#1d3a49'] },
  { id: 'media-008', type: 'photo', takenAt: '2026-03-29T21:08:00', width: 1600, height: 900, album: 'Night Markets', tags: ['lights', 'food'], location: 'Shamian', favorite: false, personLabels: ['Ari'], scene: 'market', palette: ['#1d1520', '#5e2518', '#7e4e31', '#261712'] },
  { id: 'media-009', type: 'photo', takenAt: '2026-03-27T10:14:00', width: 1600, height: 1200, album: 'Documents', tags: ['scan', 'receipts', 'archive'], location: 'Desk', favorite: false, personLabels: [], scene: 'document', palette: ['#f8f2e7', '#dfd2c2', '#d8ccb7', '#c5b8a2'] },
  { id: 'media-010', type: 'video', takenAt: '2026-03-25T13:20:00', width: 1440, height: 900, album: 'Screenshots and recordings', tags: ['screen', 'workflow'], location: 'Studio', favorite: false, personLabels: [], scene: 'screen', palette: ['#111722', '#1d2838', '#2d3950', '#38455c'] },
  { id: 'media-011', type: 'photo', takenAt: '2026-03-18T19:06:00', width: 1560, height: 960, album: 'Road Notes', tags: ['roadtrip', 'highway'], location: 'Zhuhai', favorite: false, personLabels: [], scene: 'road', palette: ['#51677e', '#d7bd91', '#2b3a45', '#161b20'] },
  { id: 'media-012', type: 'photo', takenAt: '2026-03-12T17:33:00', width: 1120, height: 1600, album: 'Portraits', tags: ['portrait', 'friends'], location: 'Guangzhou', favorite: true, personLabels: ['Ari'], scene: 'portrait', palette: ['#a78e7d', '#d4b39d', '#574848', '#1f1919'] },
  { id: 'media-013', type: 'photo', takenAt: '2026-02-16T20:45:00', width: 1600, height: 900, album: 'Festival Nights', tags: ['fireworks', 'city'], location: 'Guangzhou', favorite: true, personLabels: [], scene: 'fireworks', palette: ['#111827', '#182233', '#171f2c', '#0d121b'] },
  { id: 'media-014', type: 'photo', takenAt: '2026-02-03T09:52:00', width: 1600, height: 1000, album: 'Weekend Trails', tags: ['mountains', 'hike'], location: 'Qingyuan', favorite: false, personLabels: ['Milo'], scene: 'mountain', palette: ['#96b3cb', '#d7e2ee', '#5c6a79', '#2e3945'] },
  { id: 'media-015', type: 'photo', takenAt: '2026-01-23T08:06:00', width: 1480, height: 1110, album: 'Cafe Archive', tags: ['coffee', 'journaling'], location: 'Haizhu, Guangzhou', favorite: false, personLabels: [], scene: 'coffee', palette: ['#65412f', '#ba916e', '#8a6551', '#3d2a20'] },
  { id: 'media-016', type: 'photo', takenAt: '2025-12-21T17:18:00', width: 1600, height: 1066, album: 'Beach Days', tags: ['sea', 'travel'], location: 'Xiamen', favorite: true, personLabels: ['Ari'], scene: 'beach', palette: ['#76a9d8', '#ffe1a6', '#4d8ca6', '#f1c78b'] },
  { id: 'media-017', type: 'photo', takenAt: '2025-12-07T14:14:00', width: 1600, height: 1000, album: 'Gallery Visits', tags: ['museum', 'art'], location: 'Shenzhen', favorite: false, personLabels: [], scene: 'gallery', palette: ['#1b1722', '#544767', '#4d5f78', '#2a262f'] },
  { id: 'media-018', type: 'photo', takenAt: '2025-11-02T18:05:00', width: 1600, height: 900, album: 'Harbour Air', tags: ['sunset', 'waterfront'], location: 'Hong Kong', favorite: false, personLabels: [], scene: 'harbor', palette: ['#4e647e', '#efb378', '#2b5b6f', '#1f2933'] },
  { id: 'media-019', type: 'photo', takenAt: '2025-10-20T21:18:00', width: 1480, height: 1100, album: 'Campus Evenings', tags: ['night', 'campus'], location: 'Guangzhou', favorite: false, personLabels: [], scene: 'moonrise', palette: ['#1e2430', '#7e8596', '#12171f', '#1f2932'] },
  { id: 'media-020', type: 'video', takenAt: '2025-10-06T11:42:00', width: 1440, height: 900, album: 'Screenshots and recordings', tags: ['product', 'recording'], location: 'Studio', favorite: false, personLabels: [], scene: 'screen', palette: ['#121822', '#263147', '#30415c', '#17202b'] },
  { id: 'media-021', type: 'photo', takenAt: '2025-09-18T07:54:00', width: 1500, height: 1120, album: 'Morning Walks', tags: ['dogs', 'park'], location: 'Guangzhou', favorite: true, personLabels: ['Pepper'], scene: 'road', palette: ['#5f7286', '#cad3b2', '#30414c', '#1a2127'] },
  { id: 'media-022', type: 'photo', takenAt: '2025-09-01T15:09:00', width: 1480, height: 1110, album: 'Documents', tags: ['invoice', 'scan'], location: 'Desk', favorite: false, personLabels: [], scene: 'document', palette: ['#f2ebdf', '#efe3d0', '#d6c9b4', '#c7baa7'] },
  { id: 'media-023', type: 'photo', takenAt: '2025-08-19T20:10:00', width: 1600, height: 900, album: 'Night Markets', tags: ['festival', 'food'], location: 'Chaozhou', favorite: false, personLabels: ['Milo'], scene: 'market', palette: ['#23171a', '#7f3625', '#6a4736', '#201312'] },
  { id: 'media-024', type: 'photo', takenAt: '2025-07-11T09:45:00', width: 1600, height: 1040, album: 'Weekend Trails', tags: ['mountains', 'clouds'], location: 'Longsheng', favorite: true, personLabels: [], scene: 'mountain', palette: ['#90a7be', '#dfe8ef', '#5a6875', '#313b46'] },
  { id: 'media-025', type: 'photo', takenAt: '2025-06-16T17:15:00', width: 1600, height: 960, album: 'Blue Hour', tags: ['coast', 'sunset'], location: 'Zhoushan', favorite: false, personLabels: ['Ari'], scene: 'coast', palette: ['#789bc1', '#ffb06f', '#346074', '#23404f'] },
  { id: 'media-026', type: 'photo', takenAt: '2025-05-05T08:11:00', width: 1480, height: 1110, album: 'Botanical Notes', tags: ['flowers', 'pond'], location: 'Hangzhou', favorite: false, personLabels: [], scene: 'lilyPond', palette: ['#2d3828', '#6e854d', '#56763a', '#263126'] },
  { id: 'media-027', type: 'photo', takenAt: '2025-04-19T13:28:00', width: 1480, height: 1106, album: 'City Weekends', tags: ['bookstore', 'culture'], location: 'Shanghai', favorite: true, personLabels: [], scene: 'bookstore', palette: ['#251810', '#744421', '#51311d', '#201410'] },
  { id: 'media-028', type: 'photo', takenAt: '2025-03-03T18:50:00', width: 1488, height: 1116, album: 'Campus Details', tags: ['architecture', 'windows'], location: 'Guangzhou', favorite: false, personLabels: [], scene: 'architecture', palette: ['#c0c0c0', '#dbdbdd', '#7c7f84', '#4f565e'] },
  { id: 'media-029', type: 'photo', takenAt: '2024-12-26T21:16:00', width: 1600, height: 900, album: 'Festival Nights', tags: ['celebration', 'fireworks'], location: 'Macau', favorite: true, personLabels: ['Ari'], scene: 'fireworks', palette: ['#101621', '#16202f', '#1a2434', '#0c1118'] },
  { id: 'media-030', type: 'photo', takenAt: '2024-11-09T14:31:00', width: 1600, height: 900, album: 'Harbour Air', tags: ['harbor', 'city'], location: 'Xiamen', favorite: false, personLabels: [], scene: 'harbor', palette: ['#5d7693', '#f5b583', '#2c5768', '#1f2b33'] },
  { id: 'media-031', type: 'photo', takenAt: '2024-10-14T10:06:00', width: 1600, height: 1066, album: 'Portraits', tags: ['portrait', 'friends'], location: 'Shenzhen', favorite: false, personLabels: ['Milo'], scene: 'portrait', palette: ['#a28a7a', '#ddbea8', '#56474a', '#241c1d'] },
  { id: 'media-032', type: 'photo', takenAt: '2024-09-02T17:42:00', width: 1480, height: 1110, album: 'Cafe Archive', tags: ['coffee', 'journaling'], location: 'Foshan', favorite: false, personLabels: [], scene: 'coffee', palette: ['#5b3f33', '#c49b74', '#876250', '#35251e'] },
  { id: 'media-033', type: 'video', takenAt: '2024-08-21T12:18:00', width: 1440, height: 900, album: 'Screenshots and recordings', tags: ['tutorial', 'recording'], location: 'Studio', favorite: false, personLabels: [], scene: 'screen', palette: ['#0f1620', '#253043', '#33425d', '#1b2530'] },
  { id: 'media-034', type: 'photo', takenAt: '2024-07-12T18:04:00', width: 1600, height: 900, album: 'Road Notes', tags: ['roadtrip', 'sunset'], location: 'Yunnan', favorite: true, personLabels: [], scene: 'road', palette: ['#5a7086', '#ebb37a', '#30404b', '#171d23'] },
  { id: 'media-035', type: 'photo', takenAt: '2024-06-01T07:44:00', width: 1600, height: 1000, album: 'Beach Days', tags: ['travel', 'summer'], location: 'Sanya', favorite: false, personLabels: [], scene: 'beach', palette: ['#7aa8cf', '#fde2a6', '#4a8ba8', '#efcb8f'] },
  { id: 'media-036', type: 'photo', takenAt: '2024-04-17T16:24:00', width: 1480, height: 1110, album: 'Morning Walks', tags: ['trees', 'avenue'], location: 'Guangzhou', favorite: true, personLabels: [], scene: 'blossomStreet', palette: ['#8c9493', '#d5c8b6', '#6c6480', '#2b3238'] },
  { id: 'media-037', type: 'photo', takenAt: '2023-12-30T18:12:00', width: 1600, height: 960, album: 'Gallery Visits', tags: ['gallery', 'interior'], location: 'Beijing', favorite: false, personLabels: [], scene: 'gallery', palette: ['#1a1720', '#5c4663', '#4e6274', '#2b2630'] },
  { id: 'media-038', type: 'photo', takenAt: '2023-11-14T09:22:00', width: 1600, height: 1020, album: 'Documents', tags: ['archive', 'film scans'], location: 'Desk', favorite: false, personLabels: [], scene: 'document', palette: ['#f4efe6', '#e8ddcd', '#d6c8b3', '#bfae98'] },
  { id: 'media-039', type: 'photo', takenAt: '2023-10-08T17:56:00', width: 1600, height: 900, album: 'Weekend Trails', tags: ['mountains', 'travel'], location: 'Guilin', favorite: false, personLabels: ['Ari'], scene: 'mountain', palette: ['#91abc2', '#dfe9ef', '#576572', '#303a43'] },
  { id: 'media-040', type: 'photo', takenAt: '2023-08-19T19:42:00', width: 1600, height: 900, album: 'Harbour Air', tags: ['harbor', 'sunset'], location: 'Qingdao', favorite: true, personLabels: [], scene: 'harbor', palette: ['#556d86', '#f2b581', '#2f5867', '#212d34'] },
  { id: 'media-041', type: 'photo', takenAt: '2023-06-16T14:16:00', width: 1480, height: 1110, album: 'Campus Evenings', tags: ['night', 'architecture'], location: 'Changsha', favorite: false, personLabels: [], scene: 'architecture', palette: ['#c2c5cb', '#dfe0e4', '#798089', '#505861'] },
  { id: 'media-042', type: 'photo', takenAt: '2023-04-02T11:10:00', width: 1480, height: 1110, album: 'Home Clips', tags: ['cat', 'window'], location: 'Guangzhou', favorite: true, personLabels: ['Pepper'], scene: 'catWindow', palette: ['#84a590', '#d0ddd3', '#5b4b40', '#221d18'] }
];

export const navigationModel = {
  primary: ['Photos', 'Collections', 'Private', 'Bin'],
  secondary: ['Videos', 'Documents', 'Favourites']
};

export const storageSummary = {
  usedMb: 0,
  totalQuotaGb: 0,
  totalCount: 0,
  isLoading: true
};

export const mockMediaItems = rawItems
  .map((item) => {
    const takenAt = new Date(item.takenAt);
    return {
      ...item,
      year: takenAt.getFullYear(),
      month: takenAt.getMonth() + 1,
      day: takenAt.getDate(),
      weekday: weekdayNames[takenAt.getDay()],
      monthLabel: monthNames[takenAt.getMonth()],
      thumbnailUrl: createThumbnail(item)
    };
  })
  .sort((left, right) => new Date(right.takenAt).getTime() - new Date(left.takenAt).getTime());

export function createTimelineLabel(dateLike, now = new Date()) {
  const date = new Date(dateLike);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((midnight.getTime() - targetMidnight.getTime()) / 86400000);

  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
