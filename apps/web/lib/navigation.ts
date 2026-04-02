export const navigationItems = [
  {
    href: "/overview",
    label: "Overview",
    description: "Dashboard and system status",
    icon: "overview",
    step: null
  },
  {
    href: "/snapshots",
    label: "Snapshots",
    description: "Historical business data",
    icon: "database",
    step: 1
  },
  {
    href: "/scenarios",
    label: "Scenarios",
    description: "Policy configurations",
    icon: "sliders",
    step: 2
  },
  {
    href: "/compare",
    label: "Compare",
    description: "Side-by-side results",
    icon: "columns",
    step: 3
  }
] as const;
