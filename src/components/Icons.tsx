import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17.5H7.5A2.5 2.5 0 0 0 5 22V4.5z" />
    <path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19" />
  </Svg>
);

export const IconStar = (p: P) => (
  <Svg {...p}>
    <path
      d="M12 3.4l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.8l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9L12 3.4z"
      fill="currentColor"
      stroke="none"
    />
  </Svg>
);

export const IconFork = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="5" r="2.2" />
    <circle cx="18" cy="5" r="2.2" />
    <circle cx="12" cy="19" r="2.2" />
    <path d="M6 7.2v2.3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.2M12 12.5v4.3" />
  </Svg>
);

export const IconIssue = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16.5 16.5 21 21" />
  </Svg>
);

export const IconArrow = (p: P) => (
  <Svg {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Svg>
);

export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.4-6.5-10.3A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.7C18.5 15.6 12 21 12 21z" />
    <circle cx="12" cy="10.6" r="2.3" />
  </Svg>
);

export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Svg>
);

export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 6 .4l2.5-2.5a4 4 0 1 0-5.7-5.7L11.5 7.5" />
    <path d="M14 10a4 4 0 0 0-6-.4L5.5 12a4 4 0 1 0 5.7 5.7l1.3-1.3" />
  </Svg>
);

export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12.5 10 18 19.5 6.5" />
  </Svg>
);

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4 2.8 19.5h18.4L12 4z" />
    <path d="M12 10.2v4.3M12 17.2v.1" />
  </Svg>
);

export const IconBuilding = (p: P) => (
  <Svg {...p}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
    <path d="M9 21v-3.5h6V21M8.5 7.5h2M13.5 7.5h2M8.5 11.5h2M13.5 11.5h2" />
  </Svg>
);

export const IconAt = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M15.5 12v1.8a2.2 2.2 0 0 0 4.4 0V12a7.9 7.9 0 1 0-3 6.3" />
  </Svg>
);

export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
  </Svg>
);

export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Svg>
);

export const IconFile = (p: P) => (
  <Svg {...p}>
    <path d="M6 2.5h8l4 4V21.5H6z" />
    <path d="M14 2.5v4h4M9 12h6M9 15.5h6M9 8.5h2" />
  </Svg>
);

export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16" />
  </Svg>
);

export const IconBookmark = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 3.5h11V21L12 16.8 6.5 21z" />
  </Svg>
);

export const IconTerminal = (p: P) => (
  <Svg {...p}>
    <path d="m5 7 5 5-5 5M12.5 17H19" />
  </Svg>
);

export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconScale = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v16M8 20h8M12 4l-6 3M12 4l6 3" />
    <path d="M6 7 3.5 13a2.8 2.8 0 0 0 5 0L6 7zM18 7l-2.5 6a2.8 2.8 0 0 0 5 0L18 7z" />
  </Svg>
);

export const IconExternal = (p: P) => (
  <Svg {...p}>
    <path d="M10 5H5v14h14v-5" />
    <path d="M14 4h6v6M20 4l-9 9" />
  </Svg>
);

export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
  </Svg>
);

export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
  </Svg>
);

export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 6.5h16M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6M6.5 6.5l.8 12.5a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12.5M10 10.5v6M14 10.5v6" />
  </Svg>
);

export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18.5 14.5A6 6 0 0 1 21 20" />
  </Svg>
);

export const IconFolder = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z" />
  </Svg>
);

export const IconRadar = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" opacity=".5" />
    <path d="M12 12 18 6" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconTag = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10.5v-7h7l10 10-7 7z" />
    <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconFlame = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c.6 2.9-2.8 4.7-2.8 8a2.8 2.8 0 0 0 5.6.4c1.6 1.1 2.7 2.8 2.7 4.6a5.5 5.5 0 0 1-11 0C6.5 10.2 12 8.7 12 3.5z" />
  </Svg>
);

export const IconSwap = (p: P) => (
  <Svg {...p}>
    <path d="M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3" />
  </Svg>
);

export const IconTranslate = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 6h9.5M8 3.5V6M10.5 6c-.8 3.6-3.6 6.6-7 8M6 9.5c1.6 2.4 4.2 4.1 7 4.7" />
    <path d="m14 20.5 3.4-9 3.4 9M15.2 17.5h4.4" />
  </Svg>
);

export const IconRepoCompare = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 4v16M18.5 4v16" />
    <path d="M9 9.5h7M13.8 7.3l2.2 2.2-2.2 2.2M15 14.5H8M10.2 12.3 8 14.5l2.2 2.2" />
  </Svg>
);

export const IconKey = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="14.5" r="4.5" />
    <path d="M11.5 11 20 2.5M16 6.5l2.5 2.5M13.5 9l2 2" />
  </Svg>
);

export const IconGraph = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 20.5h17M6 16l4-5 3.5 3L19 6.5M19 11V6.5H14.5" />
  </Svg>
);

export const IconVerified = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.8 14.4 5l3.2-.2.7 3.1 2.8 1.6-1.3 2.9 1.3 2.9-2.8 1.6-.7 3.1-3.2-.2-2.4 2.2L9.6 20l-3.2.2-.7-3.1-2.8-1.6 1.3-2.9-1.3-2.9 2.8-1.6.7-3.1L9.6 5z" />
    <path d="m8.8 12.2 2.2 2.2 4.2-4.6" />
  </Svg>
);

export const IconTrophy = (p: P) => (
  <Svg {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 5H4.5v1.5A3.5 3.5 0 0 0 8 10M16 5h3.5v1.5A3.5 3.5 0 0 1 16 10M12 13v3.5M9 20.5h6M10.2 16.5h3.6l.7 4H9.5z" />
  </Svg>
);

export const IconMail = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
  </Svg>
);
