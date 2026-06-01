import 'dotenv/config';

import { randomUUID } from 'crypto';
import { pool } from './database';
import { createSchema } from './schema';

type MenuItemSeed = {
  category: string;
  name: string;
  price: number;
  description?: string;
  largePrice?: number;
  image?: string;
};

const restaurantName = 'Hotel Shanika';
const restaurantSlug = 'hotel-shanika';

const categoryImageUrls: Record<string, string> = {
  'Biriyani Set': 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=800&q=80',
  'Bite': 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
  'Chinese Kottu': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
  'Chinese Noodles': 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=800&q=80',
  'Chopsuey / Stew': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
  'Dessert': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80',
  'Egg of Your Choice': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
  'Family Combo': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
  'Family Pot Biriyani': 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=800&q=80',
  'Family Pot Nasi': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
  'Fried & Devilled': 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
  'Fried Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
  'Pizza': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
  'Rice & Curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80',
  'Set Menu Plate': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  'Shanika Cheesy Kottu': 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=800&q=80',
  'Shanika Special Pot': 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=800&q=80',
  'Soft Drink / Fruit Juice / Milkshakes': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80',
  'Soup': 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
  'Spaghetti / Pasta': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  'Submarine / Burger / Bread & Sandwiches': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
};

function sampleImageFor(category: string): string {
  return categoryImageUrls[category] ?? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
}

const items: MenuItemSeed[] = [
  { category: 'Soup', name: 'Cream of Vegetable Soup', price: 500, description: 'Served with toast' },
  { category: 'Soup', name: 'Creamy Chicken Soup', price: 600, description: 'Served with toast' },
  { category: 'Soup', name: 'Chicken & Egg Soup', price: 600, description: 'Served with toast' },
  { category: 'Soup', name: 'Chicken & Noodles Soup', price: 600, description: 'Served with toast' },
  { category: 'Soup', name: 'Prawns with Egg Soup', price: 650, description: 'Served with toast' },

  { category: 'Rice & Curry', name: 'Vegetable/Egg Rice & Curry', price: 490, description: 'Served with three vegetable curries, mix salad and crackers. Available from 12.00 p.m. - 2.00 p.m.' },
  { category: 'Rice & Curry', name: 'Chicken/Fish Rice & Curry', price: 600, description: 'Served with three vegetable curries, mix salad and crackers. Available from 12.00 p.m. - 2.00 p.m.' },
  { category: 'Rice & Curry', name: 'Pork/Beef Rice & Curry', price: 650, description: 'Served with three vegetable curries, mix salad and crackers. Available from 12.00 p.m. - 2.00 p.m.' },
  { category: 'Rice & Curry', name: 'Prawns/Cuttlefish/Crabs Rice & Curry', price: 700, description: 'Served with three vegetable curries, mix salad and crackers. Available from 12.00 p.m. - 2.00 p.m.' },
  { category: 'Rice & Curry', name: 'Mutton Rice & Curry', price: 800, description: 'Served with three vegetable curries, mix salad and crackers. Available from 12.00 p.m. - 2.00 p.m.' },

  { category: 'Fried Rice', name: 'Vegetable Fried Rice', price: 450, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Egg Fried Rice', price: 500, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Chicken Fried Rice', price: 600, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Beef/Pork Fried Rice', price: 700, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Mix Fried Rice', price: 800, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Sea Food Mix Fried Rice', price: 900, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Mongolian Rice', price: 950, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Nasi', price: 950, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Oak Special Fried Rice (Basmathi)', price: 1300, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Shanika Special Fried Rice', price: 1950, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Fried Rice', name: 'Shanika Special Seafood Fried Rice', price: 2200, description: 'Served with chili paste and tomato ketchup' },

  { category: 'Chinese Noodles', name: 'Vegetable Chinese Noodles', price: 500, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Egg Chinese Noodles', price: 600, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Chicken Chinese Noodles', price: 700, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Beef/Pork Chinese Noodles', price: 800, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Mix Chinese Noodles', price: 900, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Sea Food Mix Chinese Noodles', price: 990, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Mongolian Chinese Noodles', price: 1050, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Meegoreng', price: 1050, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Oak Special Chinese Noodles', price: 1400, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Shanika Special Chinese Noodles', price: 2050, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Noodles', name: 'Shanika Special Seafood Chinese Noodles', price: 2300, description: 'Served with chili paste and tomato ketchup' },

  { category: 'Set Menu Plate', name: 'Chicken Set Menu Plate', price: 750, description: 'Served with boiled egg, chop suey and chili paste' },
  { category: 'Set Menu Plate', name: 'Beef/Pork Set Menu Plate', price: 850, description: 'Served with boiled egg, chop suey and chili paste' },
  { category: 'Set Menu Plate', name: 'Fish/Prawns/Cuttlefish Set Menu Plate', price: 900, description: 'Served with boiled egg, chop suey and chili paste' },

  { category: 'Biriyani Set', name: 'Chicken Biriyani Set (Basmathi)', price: 1150, description: 'Served with boiled egg, chutney, minchi and raita' },
  { category: 'Biriyani Set', name: 'Tandoori Chicken Biriyani Set (Basmathi)', price: 1300, description: 'Served with boiled egg, chutney, minchi and raita' },
  { category: 'Biriyani Set', name: 'Beef Biriyani Set (Basmathi)', price: 1300, description: 'Served with boiled egg, chutney, minchi and raita' },
  { category: 'Biriyani Set', name: 'Mutton Biriyani Set (Basmathi)', price: 1500, description: 'Served with boiled egg, chutney, minchi and raita' },

  { category: 'Chinese Kottu', name: 'Vegetable/Egg Chinese Kottu', price: 600, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Kottu', name: 'Chicken Chinese Kottu', price: 700, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Kottu', name: 'Beef Chinese Kottu', price: 800, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Kottu', name: 'Pork Chinese Kottu', price: 800, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Kottu', name: 'Sea Food Chinese Kottu', price: 900, description: 'Served with chili paste and tomato ketchup' },
  { category: 'Chinese Kottu', name: 'Mongolian Chinese Kottu', price: 1000, description: 'Served with chili paste and tomato ketchup' },

  { category: 'Shanika Cheesy Kottu', name: 'Cheese Kottu', price: 800 },
  { category: 'Shanika Cheesy Kottu', name: 'Cheesy Chicken Kottu', price: 900 },
  { category: 'Shanika Cheesy Kottu', name: 'Cheesy Sea Food Kottu', price: 1050 },

  { category: 'Spaghetti / Pasta', name: 'Cheesy Chicken Spaghetti/Pasta', price: 1200, description: 'Served with tomato ketchup' },
  { category: 'Spaghetti / Pasta', name: 'Cheesy Sea Food Spaghetti/Pasta', price: 1400, description: 'Served with tomato ketchup' },

  { category: 'Fried & Devilled', name: 'Fried Chicken', price: 1200 },
  { category: 'Fried & Devilled', name: 'Devilled Chicken', price: 1100 },
  { category: 'Fried & Devilled', name: 'Fried Beef/Pork', price: 1300 },
  { category: 'Fried & Devilled', name: 'Devilled Beef/Pork', price: 1200 },
  { category: 'Fried & Devilled', name: 'Fried Sea Fish', price: 1900 },
  { category: 'Fried & Devilled', name: 'Devilled Sea Fish', price: 1600 },
  { category: 'Fried & Devilled', name: 'Fried Fish', price: 1200 },
  { category: 'Fried & Devilled', name: 'Devilled Fish', price: 1100 },
  { category: 'Fried & Devilled', name: 'Fried Prawns', price: 1300 },
  { category: 'Fried & Devilled', name: 'Devilled Prawns', price: 1300 },
  { category: 'Fried & Devilled', name: 'Fried Cuttle Fish', price: 1300 },
  { category: 'Fried & Devilled', name: 'Devilled Cuttle Fish', price: 1300 },
  { category: 'Fried & Devilled', name: 'Fried Crabs', price: 1500 },
  { category: 'Fried & Devilled', name: 'Devilled Crabs', price: 1500 },

  { category: 'Pizza', name: 'Chicken Pizza', price: 1790, largePrice: 2690, description: 'Small and large sizes. Served with tomato ketchup' },
  { category: 'Pizza', name: 'BBQ Chicken Pizza', price: 1790, largePrice: 2690, description: 'Small and large sizes. Served with tomato ketchup' },
  { category: 'Pizza', name: 'Devil Chicken Pizza', price: 1790, largePrice: 2690, description: 'Small and large sizes. Served with tomato ketchup' },
  { category: 'Pizza', name: 'Sausages Pizza', price: 1790, largePrice: 2690, description: 'Small and large sizes. Served with tomato ketchup' },
  { category: 'Pizza', name: 'Chicken Hawain Pizza', price: 1890, largePrice: 2790, description: 'Small and large sizes. Served with tomato ketchup' },
  { category: 'Pizza', name: 'Magarita Pizza', price: 1890, largePrice: 2790, description: 'Small and large sizes. Served with tomato ketchup' },
  { category: 'Pizza', name: 'Seafood Pizza', price: 2490, largePrice: 3490, description: 'Small and large sizes. Served with tomato ketchup' },
  { category: 'Pizza', name: 'Full Loaded Pizza', price: 2490, largePrice: 3490, description: 'Small and large sizes. Served with tomato ketchup' },

  { category: 'Chopsuey / Stew', name: 'Vegetable Chopsuey', price: 800, description: 'Served with rice' },
  { category: 'Chopsuey / Stew', name: 'Chicken/Fish Chopsuey', price: 1200, description: 'Served with rice' },
  { category: 'Chopsuey / Stew', name: 'Beef/Pork Chopsuey', price: 1300, description: 'Served with rice' },
  { category: 'Chopsuey / Stew', name: 'Mixed Chopsuey', price: 1400, description: 'Served with rice' },
  { category: 'Chopsuey / Stew', name: 'Chicken/Fish Stew', price: 1200 },
  { category: 'Chopsuey / Stew', name: 'Pork/Beef Stew', price: 1300 },

  { category: 'Bite', name: 'French Fries', price: 750 },
  { category: 'Bite', name: 'Pepper Beef/Pork/Chicken', price: 1300 },
  { category: 'Bite', name: 'Butter Fried Prawns/Cuttle Fish', price: 1450 },
  { category: 'Bite', name: 'Fish Finger with French Rice', price: 1200 },
  { category: 'Bite', name: 'Sausage Roll with Hot Sauce', price: 600 },
  { category: 'Bite', name: 'Hot Butter Mushroom', price: 600 },
  { category: 'Bite', name: 'Devilled Garlic', price: 600 },
  { category: 'Bite', name: 'Cashew Nut', price: 1000 },
  { category: 'Bite', name: 'Onion Okkara', price: 500 },
  { category: 'Bite', name: 'Boiled Vegetable', price: 750, description: 'Served with eggs, bread and butter' },
  { category: 'Bite', name: 'Kankung', price: 400 },
  { category: 'Bite', name: 'Kankung Chicken/Fish', price: 900 },
  { category: 'Bite', name: 'Kankun Beef/Pork', price: 950 },
  { category: 'Bite', name: 'Crispy Chicken', price: 1200 },
  { category: 'Bite', name: 'Mix Salad/Green Salad', price: 750 },
  { category: 'Bite', name: 'Mix Grill 400g', price: 2900, description: 'Beef, pork, chicken and sausage. Served with boiled vegetables, fried egg and potato vegetables' },
  { category: 'Bite', name: 'Full Roasted Chicken', price: 3500, description: 'Served with boiled vegetables and BBQ sauce' },
  { category: 'Bite', name: 'Half Roasted Chicken', price: 1900, description: 'Served with boiled vegetables and BBQ sauce' },

  { category: 'Egg of Your Choice', name: 'Sri Lanka Omelet', price: 400, description: 'Served with toast' },
  { category: 'Egg of Your Choice', name: 'Cheese/Cheese & Tomato Omelet', price: 650, description: 'Served with toast' },
  { category: 'Egg of Your Choice', name: 'Chicken/Beef/Sausage Omelet', price: 500, description: 'Served with toast' },
  { category: 'Egg of Your Choice', name: 'Boiled/Fried Egg', price: 250, description: 'Served with toast' },

  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Chicken/Crispy Chicken Submarine', price: 990, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Beef Submarine', price: 1100, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Chicken Burger', price: 790, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Crispy Chicken/Fish Burger', price: 790, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Garlic Bread', price: 550, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Cheese and Garlic/Cheese Bread', price: 650, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Vegetable/Egg Sandwich', price: 600, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Chicken/Beef/Fish Sandwich', price: 800, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Cheese/Cheese and Tomato Sandwich', price: 900, description: 'Served with french fries, coleslaw and tomato ketchup' },
  { category: 'Submarine / Burger / Bread & Sandwiches', name: 'Club Sandwich', price: 1200, description: 'Served with french fries, coleslaw and tomato ketchup' },

  { category: 'Soft Drink / Fruit Juice / Milkshakes', name: 'Coca-cola/Sprite 400ml', price: 250 },
  { category: 'Soft Drink / Fruit Juice / Milkshakes', name: 'Coca-cola/Sprite 1500ml', price: 650 },
  { category: 'Soft Drink / Fruit Juice / Milkshakes', name: 'Soda 375ml', price: 200 },
  { category: 'Soft Drink / Fruit Juice / Milkshakes', name: 'Soda 1500ml', price: 450 },
  { category: 'Soft Drink / Fruit Juice / Milkshakes', name: 'Egb/Tonic/Ginger Ale 375ml', price: 250 },
  { category: 'Soft Drink / Fruit Juice / Milkshakes', name: 'Fresh Lime with Soda', price: 450 },
  { category: 'Soft Drink / Fruit Juice / Milkshakes', name: 'Fresh Fruit Juice', price: 400 },
  { category: 'Soft Drink / Fruit Juice / Milkshakes', name: 'Milk Shake', price: 550, description: 'Vanilla, strawberry or chocolate' },

  { category: 'Dessert', name: 'Ice Cream', price: 400, description: 'Vanilla, chocolate or strawberry' },
  { category: 'Dessert', name: 'Banana Boate/Choco Nut Glory', price: 600 },
  { category: 'Dessert', name: 'Fresh Fruit Salad', price: 450 },
  { category: 'Dessert', name: 'Fresh Fruit Platter', price: 650 },
  { category: 'Dessert', name: 'Watalappam', price: 250 },
  { category: 'Dessert', name: 'Cream Caramel', price: 250 },
  { category: 'Dessert', name: 'Chocolate Mousse', price: 300 },
  { category: 'Dessert', name: 'Lava Cake', price: 450 },

  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Tandoori Chicken - Serving 01', price: 1900, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Beef - Serving 01', price: 2100, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Mutton - Serving 01', price: 2300, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Tandoori Chicken - Serving 02', price: 3500, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Beef - Serving 02', price: 3700, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Mutton - Serving 02', price: 3900, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Tandoori Chicken - Serving 03', price: 5100, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Beef - Serving 03', price: 5300, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Mutton - Serving 03', price: 5500, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Tandoori Chicken - Serving 04', price: 6700, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Beef - Serving 04', price: 6900, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },
  { category: 'Family Pot Biriyani', name: 'Pot Biriyani Mutton - Serving 04', price: 7100, description: 'Basmathi biriyani rice served with fried egg, raitha, minchi, chutney, gravy and dessert' },

  { category: 'Family Pot Nasi', name: 'Pot Nasi Tandoori Chicken - Serving 01', price: 1700, description: 'Basmathi nasi goreng rice mixed with prawns, crispy chicken, tandoori chicken, boiled egg, prawn crackers, chili paste and dessert' },
  { category: 'Family Pot Nasi', name: 'Pot Nasi Tandoori Chicken - Serving 02', price: 3200, description: 'Basmathi nasi goreng rice mixed with prawns, crispy chicken, tandoori chicken, boiled egg, prawn crackers, chili paste and dessert' },
  { category: 'Family Pot Nasi', name: 'Pot Nasi Tandoori Chicken - Serving 03', price: 4700, description: 'Basmathi nasi goreng rice mixed with prawns, crispy chicken, tandoori chicken, boiled egg, prawn crackers, chili paste and dessert' },
  { category: 'Family Pot Nasi', name: 'Pot Nasi Tandoori Chicken - Serving 04', price: 6200, description: 'Basmathi nasi goreng rice mixed with prawns, crispy chicken, tandoori chicken, boiled egg, prawn crackers, chili paste and dessert' },

  { category: 'Shanika Special Pot', name: 'Shanika Special Pot - Serving 02', price: 3500 },
  { category: 'Shanika Special Pot', name: 'Shanika Special Pot - Serving 04', price: 5700 },

  { category: 'Family Combo', name: 'Chicken Biriyani Sawan', price: 8500, description: 'Basmathi rice biriyani, whole fried chicken, fried egg, raitha, minchi sambol, chutney, chilli paste and watalappam gravy. Serves 6 pax' },
  { category: 'Family Combo', name: 'Beef Biriyani Sawan', price: 9500, description: 'Basmathi rice biriyani, fried beef, fried egg, raitha, minchi sambol, chutney, gravy, chilli paste and watalappam or caramel. Serves 6 pax' },
  { category: 'Family Combo', name: 'Mutton Biriyani Sawan', price: 10500, description: 'Basmathi rice biriyani, fried mutton, fried egg, raitha, minchi sambol, chutney, gravy, chilli paste and watalappam or caramel. Serves 6 pax' },
  { category: 'Family Combo', name: 'Chicken Fried Rice Sawan', price: 7500, description: 'Basmathi egg fried rice, whole fried chicken, vegetable chopsuey, green pea curry, prawn crackers, chilli paste and cream caramel or watalappam gravy. Serves 6 pax' },
  { category: 'Family Combo', name: 'Vegetable Fried Rice Sawan', price: 6500, description: 'Basmathi vegetable fried rice, vegetable chopsuey, devilled mushroom, brinjol moju, prawn crackers, chilli paste and fresh fruit salad. Serves 6 pax' },
  { category: 'Family Combo', name: 'Nasi Goreng Sawan', price: 9000, description: 'Nasi goreng rice mixed with prawns, full fried chicken, mixed vegetable salad, boiled egg, prawn crackers, chilli paste and cream caramel or watalappam. Serves 6 pax' },
  { category: 'Family Combo', name: 'Sea Food Rice Sawan', price: 9000, description: 'Basmathi sea food rice mixed with prawns, cuttle fish, fish, whole fried chicken, mixed vegetable salad, prawn crackers, chilli paste and cream caramel or watalappam. Serves 6 pax' },
  { category: 'Family Combo', name: 'Mix Fried Rice Sawan', price: 9000, description: 'Basmathi egg fried rice mixed with beef, sausages, whole fried chicken, mixed vegetable salad, prawn crackers, chilli paste and cream caramel or watalappam. Serves 6 pax' },
  { category: 'Family Combo', name: 'Sawal Rice', price: 6500, description: 'Special Thai rice mixed with chicken, beef, pork, prawns, cuttlefish, crabs, sausage, egg and vegetables. Serves 4 pax' },
];

async function findOrCreateRestaurant(): Promise<string> {
  const existing = await pool.query(
    'SELECT id FROM restaurants WHERE LOWER(name) = LOWER($1) OR slug = $2 LIMIT 1',
    [restaurantName, restaurantSlug],
  );

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id as string;
    await pool.query(
      "UPDATE restaurants SET name = $1, slug = $2, active = TRUE, currency = 'LKR' WHERE id = $3",
      [restaurantName, restaurantSlug, id],
    );
    return id;
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO restaurants (id, name, slug, active, created_at, currency, order_number_prefix)
     VALUES ($1, $2, $3, TRUE, $4, 'LKR', 'HS')`,
    [id, restaurantName, restaurantSlug, new Date().toISOString()],
  );
  return id;
}

async function findOrCreateCategory(restaurantId: string, name: string): Promise<string> {
  const existing = await pool.query(
    'SELECT id FROM categories WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
    [restaurantId, name],
  );
  if (existing.rows.length > 0) return existing.rows[0].id as string;

  const id = randomUUID();
  await pool.query(
    'INSERT INTO categories (id, restaurant_id, name) VALUES ($1, $2, $3)',
    [id, restaurantId, name],
  );
  return id;
}

async function upsertMenuItem(restaurantId: string, categoryId: string, item: MenuItemSeed, sortOrder: number): Promise<'created' | 'updated'> {
  const existing = await pool.query(
    'SELECT id FROM menu_items WHERE restaurant_id = $1 AND category_id = $2 AND LOWER(name) = LOWER($3) LIMIT 1',
    [restaurantId, categoryId, item.name],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE menu_items
       SET description = $1,
           price = $2,
           large_price = $3,
           image = $4,
           available = TRUE,
           sort_order = $5
       WHERE id = $6`,
      [item.description ?? '', item.price, item.largePrice ?? null, item.image ?? sampleImageFor(item.category), sortOrder, existing.rows[0].id],
    );
    return 'updated';
  }

  await pool.query(
     `INSERT INTO menu_items
       (id, restaurant_id, name, description, price, discount_pct, large_price, large_discount_pct,
        category_id, image, available, track_stock, stock, sort_order, tags, prep_time_mins, schedule_id)
     VALUES
       ($1, $2, $3, $4, $5, 0, $6, 0, $7, $8, TRUE, FALSE, NULL, $9, '[]', NULL, NULL)`,
    [
      randomUUID(),
      restaurantId,
      item.name,
      item.description ?? '',
      item.price,
      item.largePrice ?? null,
      categoryId,
      item.image ?? sampleImageFor(item.category),
      sortOrder,
    ],
  );
  return 'created';
}

async function main() {
  await createSchema();
  const restaurantId = await findOrCreateRestaurant();
  const categoryIds = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const item of items) {
    let categoryId = categoryIds.get(item.category);
    if (!categoryId) {
      categoryId = await findOrCreateCategory(restaurantId, item.category);
      categoryIds.set(item.category, categoryId);
    }

    const sortOrder = items.filter((candidate) => candidate.category === item.category).indexOf(item);
    const result = await upsertMenuItem(restaurantId, categoryId, item, sortOrder);
    if (result === 'created') created++;
    else updated++;
  }

  console.log(`Hotel Shanika menu seed complete. Restaurant ID: ${restaurantId}`);
  console.log(`Categories: ${categoryIds.size}`);
  console.log(`Items created: ${created}`);
  console.log(`Items updated: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
