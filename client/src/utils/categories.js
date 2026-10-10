import { Backpack, Bike, Headphones, KeyRound, Laptop, Luggage, Package, Smartphone, Wallet } from "lucide-react";

export const CATEGORIES = [
  { value: "bag", label: "Bag", icon: Backpack },
  { value: "laptop", label: "Laptop", icon: Laptop },
  { value: "phone", label: "Phone", icon: Smartphone },
  { value: "keys", label: "Keys", icon: KeyRound },
  { value: "wallet", label: "Wallet", icon: Wallet },
  { value: "luggage", label: "Luggage", icon: Luggage },
  { value: "headphones", label: "Headphones", icon: Headphones },
  { value: "bike", label: "Bike", icon: Bike },
  { value: "other", label: "Other", icon: Package },
];

const BY_VALUE = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export function getCategory(value) {
  return BY_VALUE[value] || BY_VALUE.other;
}
