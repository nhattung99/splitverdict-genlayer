export const GROUP_PRESETS = [
  { id: 'tokyo', icon: '✈️', name: 'Tokyo trip', blurb: 'Flights, Airbnb, ramen' },
  { id: 'apt', icon: '🏠', name: 'Apartment 4B', blurb: 'Rent extras + groceries' },
  { id: 'hack', icon: '💻', name: 'Hackathon dinner', blurb: 'Team meal after demo' },
];

export const EXPENSE_PRESETS = [
  {
    id: 'dinner',
    icon: '🍜',
    name: 'Dinner',
    blurb: 'Split the table',
    description: 'Team dinner after demo day. Receipt shows the full table total; we agreed to split food evenly and assign drinks to whoever ordered them.',
  },
  {
    id: 'airbnb',
    icon: '🛏️',
    name: 'Airbnb',
    blurb: 'Shared lodging',
    description: 'Airbnb for the weekend trip. One person booked and paid the host; the rest of the group reimburses their room-nights.',
  },
  {
    id: 'uber',
    icon: '🚕',
    name: 'Uber / transit',
    blurb: 'Rides and trains',
    description: 'Airport Uber and local transit cards. Payer covered the rides; split by who was actually in each car.',
  },
  {
    id: 'groceries',
    icon: '🛒',
    name: 'Groceries',
    blurb: 'Shared fridge',
    description: 'Weekly grocery run for the apartment. Shared staples split evenly; personal snacks stay with whoever bought them.',
  },
];

export const AMOUNT_PRESETS = ['0.1', '0.5', '1', '2', '5', '10'];
