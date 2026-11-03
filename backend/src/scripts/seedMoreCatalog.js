import 'dotenv/config';
import { db, isFirebaseInitialized } from '../config/firebaseAdmin.js';
import { computePricing } from '../controllers/packageController.js';
import { computeBookingDeadline } from '../controllers/departureController.js';
import { todayInManila, addDaysToDateStr } from '../utils/dates.js';

/**
 * Adds 10 more Philippine destinations and 10 tour packages (one per destination) with
 * open departures. CREATE-ONLY: anything whose name already exists is skipped, never
 * overwritten, so staff edits made in the admin portal are preserved. Safe to re-run.
 *
 *   cd backend && node src/scripts/seedMoreCatalog.js
 *
 * Images are Wikimedia Commons lead photos of each place (verified by eye).
 */
const C = (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=1200`;

const act = (timeSlot, activityName, locationName, lat, lng, description) => ({
  timeSlot,
  activityName,
  locationName,
  coordinates: { lat, lng },
  description,
});

const CATALOG = [
  {
    destination: {
      name: 'Boracay',
      region: 'Western Visayas',
      location: 'Malay, Aklan, Philippines',
      coordinates: { lat: 11.9674, lng: 121.9248 },
      category: 'Beach',
      description: 'World-famous for its 4-kilometer powdery White Beach, glowing sunsets, paraw sailing, and lively beachfront dining.',
      recommendedActivities: ['Paraw Sunset Sailing', 'Island Hopping', 'Mount Luho Viewpoint', 'Kitesurfing at Bulabog'],
      imageUrls: [C('Boracay_White_Beach.png'), C('Boracay_white_beach_in_2014.jpg')],
      isFeatured: true,
    },
    package: {
      name: 'Boracay White Beach & Island Hopping Escape',
      category: 'Beach',
      description: 'Four laid-back days on Boracay: paraw sunset sails, island hopping to Crystal Cove and Puka Beach, and the island’s best viewpoint.',
      pricePerPerson: 13500,
      discountPercent: 10,
      durationDays: 4,
      durationNights: 3,
      cancellationCutoffDays: 7,
      inclusions: ['3 Nights Station 2 Beach Resort', 'Island Hopping Boat with Snorkel Gear', 'Paraw Sunset Sail', 'Daily Breakfast', 'Caticlan Airport & Jetty Transfers'],
      exclusions: ['Airfare to Caticlan', 'Environmental & Terminal Fees', 'Personal Expenses'],
      accommodationDetails: 'Air-conditioned beachfront resort room in Station 2 with daily breakfast.',
      transportDetails: 'Van and boat transfers from Caticlan, e-trike island transport, motorized banca for island hopping.',
      isFeatured: true,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Arrival & White Beach Sunset', activities: [
          act('02:00 PM', 'Resort Check-in', 'Station 2, White Beach', 11.9592, 121.9262, 'Transfer from Caticlan jetty and settle into your beachfront room.'),
          act('05:30 PM', 'Paraw Sunset Sail', 'White Beach', 11.9619, 121.9246, 'Sail a traditional outrigger paraw as the sun sets over the Sibuyan Sea.'),
        ] },
        { dayNumber: 2, dayTitle: 'Island Hopping Day', activities: [
          act('09:00 AM', 'Crystal Cove Island', 'Crystal Cove', 11.9325, 121.9424, 'Explore sea caves and viewpoints on this small private island.'),
          act('12:00 PM', 'Puka Shell Beach Lunch', 'Puka Shell Beach', 11.9946, 121.9126, 'Grilled seafood lunch on the quieter northern beach.'),
        ] },
        { dayNumber: 3, dayTitle: 'Viewpoints & Kite Beach', activities: [
          act('08:00 AM', 'Mount Luho Viewpoint', 'Mount Luho', 11.9758, 121.933, 'Climb to the island’s highest point for 360° views.'),
          act('02:00 PM', 'Bulabog Beach Kitesurfing', 'Bulabog Beach', 11.9618, 121.933, 'Watch or try kitesurfing on Boracay’s windy east coast.'),
        ] },
        { dayNumber: 4, dayTitle: 'Departure', activities: [
          act('09:00 AM', 'Cagban Jetty Transfer', 'Cagban Jetty Port', 11.9437, 121.9327, 'Boat and van transfer back to Caticlan Airport.'),
        ] },
      ],
    },
    meetingPoint: 'Caticlan Jetty Port Terminal',
  },
  {
    destination: {
      name: 'Banaue',
      region: 'Cordillera Administrative Region',
      location: 'Ifugao, Philippines',
      coordinates: { lat: 16.9137, lng: 121.0614 },
      category: 'Heritage',
      description: 'Home of the 2,000-year-old Ifugao rice terraces carved into the Cordillera mountains — a UNESCO World Heritage landscape.',
      recommendedActivities: ['Batad Amphitheater Trek', 'Tappiya Falls Swim', 'Hapao Terraces Walk', 'Ifugao Village Visit'],
      imageUrls: [C('Banaue-terrace.JPG')],
      isFeatured: true,
    },
    package: {
      name: 'Banaue & Batad Rice Terraces Trek',
      category: 'Heritage',
      description: 'Trek the amphitheater terraces of Batad, swim under Tappiya Falls, and meet Ifugao communities who still farm the ancient terraces.',
      pricePerPerson: 8900,
      durationDays: 3,
      durationNights: 2,
      cancellationCutoffDays: 7,
      inclusions: ['2 Nights Mountain Inn', 'Licensed Ifugao Trek Guide', 'Batad & Hapao Environmental Fees', 'Daily Breakfast & Packed Lunches'],
      exclusions: ['Bus Fare Manila–Banaue', 'Personal Porter Fees'],
      accommodationDetails: 'Family-run mountain inn overlooking the terraces, with hot showers.',
      transportDetails: 'Jeepney transfers between Banaue, Batad saddle and Hapao.',
      isFeatured: true,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Banaue Viewpoint & Hapao', activities: [
          act('08:00 AM', 'Banaue Viewpoint', 'Banaue Viewpoint', 16.9269, 121.061, 'Classic panorama of the Banaue terraces.'),
          act('02:00 PM', 'Hapao Terraces Walk', 'Hapao Rice Terraces', 16.8597, 121.0228, 'Walk the stone-walled terraces down to the Hapao river.'),
        ] },
        { dayNumber: 2, dayTitle: 'Batad Amphitheater & Tappiya Falls', activities: [
          act('07:00 AM', 'Batad Terraces Trek', 'Batad Rice Terraces', 16.9654, 121.1021, 'Descend into the amphitheater-shaped terraces of Batad.'),
          act('11:00 AM', 'Tappiya Falls Swim', 'Tappiya Falls', 16.9741, 121.108, 'Cool off in the plunge pool beneath the 70-meter falls.'),
        ] },
        { dayNumber: 3, dayTitle: 'Bangaan Village & Return', activities: [
          act('09:00 AM', 'Bangaan Village Visit', 'Bangaan', 16.9511, 121.0852, 'Visit a traditional Ifugao village of thatched native houses.'),
        ] },
      ],
    },
    meetingPoint: 'Banaue Tourist Information Center',
  },
  {
    destination: {
      name: 'Puerto Princesa',
      region: 'MIMAROPA',
      location: 'Palawan, Philippines',
      coordinates: { lat: 10.1925, lng: 118.9266 },
      category: 'Nature',
      description: 'Gateway to the Puerto Princesa Subterranean River, a navigable underground river and one of the New 7 Wonders of Nature.',
      recommendedActivities: ['Underground River Cruise', 'Sabang Mangrove Paddle', 'Honda Bay Island Hopping', 'City Heritage Tour'],
      imageUrls: [C('Puerto-Princesa_Subterranean_River_National_Park-112012.jpg')],
      isFeatured: false,
    },
    package: {
      name: 'Puerto Princesa Underground River Adventure',
      category: 'Nature',
      description: 'Paddle into the limestone caverns of the Underground River, glide through Sabang mangroves, and island-hop Honda Bay.',
      pricePerPerson: 9800,
      durationDays: 3,
      durationNights: 2,
      cancellationCutoffDays: 7,
      inclusions: ['2 Nights City Hotel', 'Underground River Permit & Boat', 'Sabang Mangrove Paddle Boat', 'Honda Bay Island Hopping', 'Buffet Lunches'],
      exclusions: ['Airfare to Puerto Princesa', 'Dinners'],
      accommodationDetails: 'Air-conditioned hotel room in Puerto Princesa city with breakfast.',
      transportDetails: 'Air-conditioned van to Sabang (2 hours), paddle boats and motorized banca.',
      isFeatured: false,
      itinerary: [
        { dayNumber: 1, dayTitle: 'City Heritage Tour', activities: [
          act('01:00 PM', 'Plaza Cuartel', 'Plaza Cuartel', 9.7415, 118.734, 'Learn the WWII history of this former garrison.'),
          act('05:00 PM', 'Baywalk Sunset', 'Puerto Princesa Baywalk', 9.7372, 118.7352, 'Seafood dinner stalls along the bay.'),
        ] },
        { dayNumber: 2, dayTitle: 'Underground River Day', activities: [
          act('07:00 AM', 'Sabang Wharf Boarding', 'Sabang Wharf', 10.1993, 118.8964, 'Boat ride to the river entrance.'),
          act('09:30 AM', 'Subterranean River Cruise', 'Underground River Entrance', 10.1925, 118.9266, 'Paddle 1.5 km into cathedral-like caverns of stalactites.'),
          act('02:00 PM', 'Mangrove Paddle Tour', 'Sabang Mangrove Forest', 10.1906, 118.8862, 'Quiet paddle through old-growth mangroves.'),
        ] },
        { dayNumber: 3, dayTitle: 'Honda Bay Island Hopping', activities: [
          act('08:00 AM', 'Cowrie Island', 'Honda Bay', 9.881, 118.784, 'Snorkel and swim on sandbars before your flight.'),
        ] },
      ],
    },
    meetingPoint: 'Puerto Princesa International Airport Arrival Area',
  },
  {
    destination: {
      name: 'Vigan',
      region: 'Ilocos Region',
      location: 'Ilocos Sur, Philippines',
      coordinates: { lat: 17.5747, lng: 120.3869 },
      category: 'Heritage',
      description: 'A UNESCO World Heritage city of cobblestone streets, Spanish-colonial ancestral houses, and horse-drawn kalesa rides.',
      recommendedActivities: ['Calle Crisologo Kalesa Ride', 'Pagburnayan Pottery', 'Bantay Bell Tower', 'Dancing Fountain Show'],
      imageUrls: [C('Calle_Crisologo%2C_Vigan%2C_Ilocos_Sur%2C_Apr_2026_%282%29.jpg')],
      isFeatured: false,
    },
    package: {
      name: 'Vigan Heritage & Ilocos Food Trail',
      category: 'Heritage',
      description: 'Ride a kalesa down Calle Crisologo, shape clay jars at a burnay pottery, and taste empanada and bagnet straight from Ilocano kitchens.',
      pricePerPerson: 7500,
      durationDays: 3,
      durationNights: 2,
      cancellationCutoffDays: 5,
      inclusions: ['2 Nights Heritage House Hotel', 'Kalesa City Tour', 'Pottery Workshop', 'Ilocano Food Tasting', 'Daily Breakfast'],
      exclusions: ['Bus or Airfare to Vigan', 'Souvenirs'],
      accommodationDetails: 'Restored Spanish-era ancestral house hotel in the heritage district.',
      transportDetails: 'Kalesa (horse-drawn carriage) and tricycle transfers within Vigan.',
      isFeatured: false,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Calle Crisologo by Night', activities: [
          act('03:00 PM', 'Calle Crisologo Kalesa Ride', 'Calle Crisologo', 17.5714, 120.3874, 'Clip-clop past 18th-century stone houses.'),
          act('07:00 PM', 'Dancing Fountain Show', 'Plaza Salcedo', 17.5747, 120.3893, 'Light-and-water show beside the cathedral.'),
        ] },
        { dayNumber: 2, dayTitle: 'Crafts & Bell Towers', activities: [
          act('09:00 AM', 'Burnay Pottery Workshop', 'Pagburnayan', 17.5711, 120.3829, 'Try the carabao-powered potter’s wheel.'),
          act('03:00 PM', 'Bantay Bell Tower', 'Bantay Church Bell Tower', 17.5825, 120.3906, 'Climb the watchtower for views over Vigan.'),
        ] },
        { dayNumber: 3, dayTitle: 'Food Trail & Departure', activities: [
          act('08:00 AM', 'Vigan Empanada Breakfast', 'Plaza Burgos', 17.5735, 120.3879, 'Orange-crusted Vigan empanada fresh from the fryer.'),
        ] },
      ],
    },
    meetingPoint: 'Plaza Salcedo, Vigan City',
  },
  {
    destination: {
      name: 'Sagada',
      region: 'Cordillera Administrative Region',
      location: 'Mountain Province, Philippines',
      coordinates: { lat: 17.0841, lng: 120.9008 },
      category: 'Mountain',
      description: 'A cool pine-covered mountain town known for hanging coffins, limestone caves, sea-of-clouds sunrises, and lemon pie.',
      recommendedActivities: ['Kiltepan Sunrise', 'Sumaguing Cave Spelunking', 'Echo Valley Hanging Coffins', 'Bomod-ok Falls Hike'],
      imageUrls: [C('Sagada_skyline_%28Sagada%2C_Mountain_Province%3B_12-01-2022%29.jpg')],
      isFeatured: false,
    },
    package: {
      name: 'Sagada Caves, Clouds & Hanging Coffins',
      category: 'Adventure',
      description: 'Spelunk Sumaguing Cave, catch the Kiltepan sea of clouds at dawn, and hike to the hanging coffins of Echo Valley.',
      pricePerPerson: 6900,
      durationDays: 3,
      durationNights: 2,
      cancellationCutoffDays: 5,
      inclusions: ['2 Nights Pine Lodge', 'Accredited Local Guides', 'Cave & Environmental Fees', 'Kiltepan Sunrise Transfer', 'Daily Breakfast'],
      exclusions: ['Bus Fare Manila–Sagada', 'Lunches & Dinners'],
      accommodationDetails: 'Cozy pine-wood lodge in town center (cool climate — bring a jacket).',
      transportDetails: 'Local jeepney and van transfers; trails on foot with guides.',
      isFeatured: false,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Echo Valley & Sumaguing Cave', activities: [
          act('10:00 AM', 'Echo Valley Hanging Coffins', 'Echo Valley', 17.088, 120.899, 'See the centuries-old coffins hung on limestone cliffs.'),
          act('03:00 PM', 'Sumaguing Cave Spelunking', 'Sumaguing Cave', 17.0763, 120.9135, 'Guided descent through rock formations and cold pools.'),
        ] },
        { dayNumber: 2, dayTitle: 'Sea of Clouds & Bomod-ok Falls', activities: [
          act('05:00 AM', 'Kiltepan Sunrise', 'Kiltepan Peak', 17.095, 120.9213, 'Watch the sun rise over a sea of clouds.'),
          act('10:00 AM', 'Bomod-ok Falls Hike', 'Bomod-ok Falls', 17.064, 120.928, 'Trek through rice terraces to the "Big Falls".'),
        ] },
        { dayNumber: 3, dayTitle: 'Pottery & Lemon Pie', activities: [
          act('09:00 AM', 'Sagada Pottery Visit', 'Sagada Town', 17.083, 120.902, 'Local pottery and the famous lemon pie before heading home.'),
        ] },
      ],
    },
    meetingPoint: 'Sagada Municipal Tourism Office',
  },
  {
    destination: {
      name: 'Moalboal',
      region: 'Central Visayas',
      location: 'Cebu, Philippines',
      coordinates: { lat: 9.9397, lng: 123.3956 },
      category: 'Beach',
      description: 'A laid-back dive town on Cebu’s southwest coast famous for the sardine run, sea turtles, and nearby Kawasan Falls canyoneering.',
      recommendedActivities: ['Sardine Run Snorkeling', 'Kawasan Falls Canyoneering', 'Pescador Island Diving', 'Turtle Watching'],
      imageUrls: [C('Moalboal_2025-07-05_021.jpg'), C('Kawasan_Falls_Level_1%2C_Badian%2C_Cebu_in_2026.jpg')],
      isFeatured: false,
    },
    package: {
      name: 'Cebu Moalboal Sardine Run & Kawasan Canyoneering',
      category: 'Adventure',
      description: 'Snorkel among millions of sardines, swim with sea turtles, and jump, slide and swim through the turquoise canyon to Kawasan Falls.',
      pricePerPerson: 8500,
      discountPercent: 15,
      durationDays: 3,
      durationNights: 2,
      cancellationCutoffDays: 7,
      inclusions: ['2 Nights Panagsama Beach Resort', 'Canyoneering Guide, Helmet & Life Vest', 'Snorkel Gear', 'Pescador Island Boat Trip', 'Daily Breakfast'],
      exclusions: ['Airfare to Cebu', 'Scuba Diving Upgrade'],
      accommodationDetails: 'Garden-view resort room steps from Panagsama Beach.',
      transportDetails: 'Private van from Cebu City (3 hours) and motorized banca.',
      isFeatured: false,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Panagsama & Sardine Run', activities: [
          act('02:00 PM', 'Resort Check-in', 'Panagsama Beach', 9.9415, 123.3693, 'Arrive from Cebu City and check in.'),
          act('04:00 PM', 'Sardine Run Snorkel', 'Moalboal Sardine Run', 9.945, 123.366, 'Swim among swirling shoals just off the beach.'),
        ] },
        { dayNumber: 2, dayTitle: 'Kawasan Canyoneering', activities: [
          act('07:00 AM', 'Canyoneering Jump-off', 'Kanlaob River, Alegria', 9.79, 123.388, 'Gear up and begin the river canyon descent.'),
          act('12:00 PM', 'Kawasan Falls Swim', 'Kawasan Falls', 9.8053, 123.3729, 'Finish at the famous turquoise three-tiered falls.'),
        ] },
        { dayNumber: 3, dayTitle: 'Pescador Island Turtles', activities: [
          act('07:00 AM', 'Pescador Island Snorkel', 'Pescador Island', 9.9233, 123.3409, 'Reef walls and sea turtles before returning to Cebu.'),
        ] },
      ],
    },
    meetingPoint: 'Cebu South Bus Terminal',
  },
  {
    destination: {
      name: 'Camiguin',
      region: 'Northern Mindanao',
      location: 'Camiguin, Philippines',
      coordinates: { lat: 9.1732, lng: 124.7299 },
      category: 'Island',
      description: 'The "Island Born of Fire" — seven volcanoes, the White Island sandbar, hot and cold springs, and the famous Sunken Cemetery.',
      recommendedActivities: ['White Island Sandbar', 'Sunken Cemetery Snorkel', 'Katibawasan Falls', 'Hibok-Hibok Trek'],
      imageUrls: [C('Timpoong_and_Hibok-Hibok_Natural_Monument_in_Camiguin_-_Allan_Jay_Quesada.jpg')],
      isFeatured: false,
    },
    package: {
      name: 'Camiguin Volcano Island Explorer',
      category: 'Island Hopping',
      description: 'Sunrise on the White Island sandbar, snorkel over the Sunken Cemetery, and soak in hot springs beneath Camiguin’s volcanoes.',
      pricePerPerson: 11200,
      durationDays: 4,
      durationNights: 3,
      cancellationCutoffDays: 7,
      inclusions: ['3 Nights Beach Resort', 'Island Circumferential Tour', 'White Island Boat', 'Hot & Cold Springs Entrance', 'Daily Breakfast'],
      exclusions: ['Airfare / Ferry to Camiguin', 'Volcano Trek Permit'],
      accommodationDetails: 'Seaside resort in Mambajao facing White Island.',
      transportDetails: 'Multicab island tour and motorized banca to White Island.',
      isFeatured: false,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Sunken Cemetery & Ruins', activities: [
          act('02:00 PM', 'Sunken Cemetery', 'Sunken Cemetery, Catarman', 9.2131, 124.6564, 'Snorkel around the cross marking a cemetery lost to an 1871 eruption.'),
          act('04:30 PM', 'Guiob Church Ruins', 'Guiob Church Ruins', 9.2135, 124.661, 'Walk the coral-stone ruins at golden hour.'),
        ] },
        { dayNumber: 2, dayTitle: 'White Island & Waterfalls', activities: [
          act('06:00 AM', 'White Island Sunrise', 'White Island Sandbar', 9.2612, 124.6575, 'Crescent sandbar with Mount Hibok-Hibok as backdrop.'),
          act('11:00 AM', 'Katibawasan Falls', 'Katibawasan Falls', 9.208, 124.716, 'A 70-meter falls in a fern-filled gorge.'),
        ] },
        { dayNumber: 3, dayTitle: 'Hot Springs Day', activities: [
          act('02:00 PM', 'Ardent Hot Spring', 'Ardent Hot Spring', 9.211, 124.699, 'Volcanically heated pools in the forest.'),
        ] },
        { dayNumber: 4, dayTitle: 'Departure', activities: [
          act('09:00 AM', 'Benoni Port Transfer', 'Benoni Port', 9.1072, 124.7328, 'Ferry transfer to Balingoan, Misamis Oriental.'),
        ] },
      ],
    },
    meetingPoint: 'Benoni Port, Mahinog',
  },
  {
    destination: {
      name: 'Siquijor',
      region: 'Central Visayas',
      location: 'Siquijor, Philippines',
      coordinates: { lat: 9.1999, lng: 123.5952 },
      category: 'Cultural',
      description: 'A mystical island of coral-stone churches, folk healers, turquoise waterfalls, and quiet white-sand beaches.',
      recommendedActivities: ['Cambugahay Falls', 'Lazi Church & Convent', 'Century-Old Balete Tree', 'Paliton Beach Sunset'],
      imageUrls: [C('St._Francis_of_Assisi_Church_%28Siquijor%2C_Siquijor%29.jpg')],
      isFeatured: false,
    },
    package: {
      name: 'Siquijor Mystic Island Getaway',
      category: 'Nature',
      description: 'Rope-swing into Cambugahay Falls, visit centuries-old coral-stone churches, and end each day on a sunset beach.',
      pricePerPerson: 7800,
      durationDays: 3,
      durationNights: 2,
      cancellationCutoffDays: 7,
      inclusions: ['2 Nights Beach Resort', 'Island Tour by Tricycle', 'Waterfall & Heritage Site Fees', 'Daily Breakfast'],
      exclusions: ['Ferry from Dumaguete', 'Healing Ritual Donations'],
      accommodationDetails: 'Beachfront cottage resort in San Juan.',
      transportDetails: 'Private tricycle island tour; ferry transfers arranged on request.',
      isFeatured: false,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Arrival & Paliton Sunset', activities: [
          act('01:00 PM', 'Siquijor Port Arrival', 'Siquijor Port', 9.2149, 123.5146, 'Meet your guide at the port.'),
          act('05:00 PM', 'Paliton Beach Sunset', 'Paliton Beach', 9.1788, 123.4627, 'Quiet white sand framed by coconut palms.'),
        ] },
        { dayNumber: 2, dayTitle: 'Falls & Heritage Loop', activities: [
          act('09:00 AM', 'Cambugahay Falls', 'Cambugahay Falls', 9.1375, 123.6215, 'Tiered turquoise pools with rope swings.'),
          act('12:00 PM', 'Lazi Church & Convent', 'Lazi Church', 9.127, 123.6352, 'One of the largest Spanish-era convents in Asia.'),
          act('03:00 PM', 'Century-Old Balete Tree', 'Balete Tree, Lazi', 9.1562, 123.4889, 'Fish spa beneath a giant enchanted balete.'),
        ] },
        { dayNumber: 3, dayTitle: 'Salagdoong Beach', activities: [
          act('08:00 AM', 'Salagdoong Cliff Jumping', 'Salagdoong Beach', 9.2047, 123.6748, 'Morning swim before the ferry home.'),
        ] },
      ],
    },
    meetingPoint: 'Siquijor Port Terminal',
  },
  {
    destination: {
      name: 'Albay',
      region: 'Bicol Region',
      location: 'Legazpi, Albay, Philippines',
      coordinates: { lat: 13.2576, lng: 123.6856 },
      category: 'Mountain',
      description: 'Home of Mayon Volcano, the world’s most perfectly shaped cone, overlooking the Cagsawa Ruins and Bicol’s spicy cuisine.',
      recommendedActivities: ['Mayon ATV Lava Trail', 'Cagsawa Ruins', 'Ligñon Hill Zipline', 'Bicol Express Food Tour'],
      imageUrls: [C('Mount_Mayon_Cagsawa_field_view_close-up_%28Busay%2C_Daraga%2C_Albay%3B_04-21-2023%29.jpg')],
      isFeatured: false,
    },
    package: {
      name: 'Albay Mayon Volcano ATV & Bicol Flavors',
      category: 'Adventure',
      description: 'Ride an ATV across Mayon’s lava fields, photograph the volcano from Cagsawa Ruins, and taste fiery Bicol Express and pili treats.',
      pricePerPerson: 8200,
      durationDays: 3,
      durationNights: 2,
      cancellationCutoffDays: 7,
      inclusions: ['2 Nights Legazpi Hotel', 'Mayon ATV Lava Trail Ride', 'Cagsawa & Ligñon Hill Entrance', 'Bicolano Food Tasting', 'Daily Breakfast'],
      exclusions: ['Airfare to Daraga (Bicol International)', 'Zipline Add-on'],
      accommodationDetails: 'City hotel in Legazpi with Mayon-view rooms on request.',
      transportDetails: 'Air-conditioned van; ATVs with guide on the lava trail.',
      isFeatured: false,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Cagsawa & Ligñon Hill', activities: [
          act('01:00 PM', 'Cagsawa Ruins', 'Cagsawa Ruins', 13.1665, 123.6539, 'Belfry ruins of a church buried in the 1814 eruption.'),
          act('04:00 PM', 'Ligñon Hill Sunset', 'Ligñon Hill', 13.1545, 123.7307, 'Panoramic view of Mayon and Albay Gulf.'),
        ] },
        { dayNumber: 2, dayTitle: 'Mayon Lava Trail', activities: [
          act('07:00 AM', 'ATV Lava Trail', 'Mayon Lava Front', 13.205, 123.68, 'Ride across boulder-strewn lava fields toward the volcano.'),
          act('02:00 PM', 'Daraga Church', 'Daraga Church', 13.148, 123.712, 'Baroque church on a hill facing Mayon.'),
        ] },
        { dayNumber: 3, dayTitle: 'Sumlang Lake & Departure', activities: [
          act('08:00 AM', 'Sumlang Lake Bamboo Raft', 'Sumlang Lake', 13.19, 123.64, 'Bamboo raft ride with Mayon reflected on the lake.'),
        ] },
      ],
    },
    meetingPoint: 'Bicol International Airport, Daraga',
  },
  {
    destination: {
      name: 'Hundred Islands',
      region: 'Ilocos Region',
      location: 'Alaminos, Pangasinan, Philippines',
      coordinates: { lat: 16.2, lng: 120.0333 },
      category: 'Island',
      description: 'A national park of 124 limestone islets scattered across Lingayen Gulf, with caves, snorkeling spots and island picnics.',
      recommendedActivities: ['Island Hopping', 'Governor’s Island Viewpoint', 'Marcos Island Cave Jump', 'Snorkeling'],
      imageUrls: [C('Hundred_Island_National_Park%2C_Pangasinan.jpg')],
      isFeatured: false,
    },
    package: {
      name: 'Hundred Islands Weekend Island Hopping',
      category: 'Island Hopping',
      description: 'A quick weekend from Manila: hop between limestone islets, climb Governor’s Island viewpoint, and cave-jump at Marcos Island.',
      pricePerPerson: 4900,
      durationDays: 2,
      durationNights: 1,
      cancellationCutoffDays: 3,
      inclusions: ['1 Night Alaminos Hotel', 'Private Island Hopping Boat', 'Park Entrance & Environmental Fees', 'Picnic Lunch on Quezon Island'],
      exclusions: ['Bus Fare Manila–Alaminos', 'Snorkel Gear Rental'],
      accommodationDetails: 'Standard hotel room near Lucap Wharf.',
      transportDetails: 'Motorized banca between islands; tricycle transfers in Alaminos.',
      isFeatured: false,
      itinerary: [
        { dayNumber: 1, dayTitle: 'Island Hopping Day', activities: [
          act('08:00 AM', 'Lucap Wharf Boarding', 'Lucap Wharf', 16.181, 119.987, 'Board your private banca.'),
          act('09:30 AM', 'Governor’s Island Viewpoint', 'Governor’s Island', 16.1942, 120.0158, 'Climb to the deck overlooking dozens of islets.'),
          act('01:00 PM', 'Quezon Island Picnic', 'Quezon Island', 16.2043, 120.0294, 'Lunch and swimming on the park’s main beach island.'),
          act('03:00 PM', 'Marcos Island Cave Jump', 'Marcos Island', 16.2155, 120.0219, 'Jump into the sea from a limestone cave.'),
        ] },
        { dayNumber: 2, dayTitle: 'Bolinao Side Trip & Return', activities: [
          act('08:00 AM', 'Patar White Beach', 'Patar Beach, Bolinao', 16.3197, 119.7862, 'Morning swim before the trip back to Manila.'),
        ] },
      ],
    },
    meetingPoint: 'Lucap Wharf, Alaminos City',
  },
];

// Three upcoming departures per package (days from today, Manila time)
const DEPARTURE_OFFSETS = [12, 26, 40];

async function seedMoreCatalog() {
  if (!isFirebaseInitialized || !db) {
    console.error('Firebase Admin is not initialized.');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const today = todayInManila();
  const summary = { destinations: 0, packages: 0, departures: 0, skipped: 0 };

  for (const entry of CATALOG) {
    // Destination (create-only)
    const destSnap = await db.collection('destinations').where('name', '==', entry.destination.name).limit(1).get();
    let destinationId;
    if (destSnap.empty) {
      const ref = await db.collection('destinations').add({
        country: 'Philippines',
        isPublished: true,
        ...entry.destination,
        createdAt: now,
        updatedAt: now,
      });
      destinationId = ref.id;
      summary.destinations++;
      console.log(`+ Destination: ${entry.destination.name}`);
    } else {
      destinationId = destSnap.docs[0].id;
      summary.skipped++;
      console.log(`= Destination exists, skipped: ${entry.destination.name}`);
    }

    // Package (create-only), stored with the same fields createPackage writes
    const { discountPercent = 0, ...pkg } = entry.package;
    const pkgSnap = await db.collection('tourPackages').where('name', '==', pkg.name).limit(1).get();
    if (!pkgSnap.empty) {
      summary.skipped++;
      console.log(`= Package exists, skipped: ${pkg.name}`);
      continue;
    }
    const pricing = computePricing(pkg.pricePerPerson, discountPercent);
    const pkgRef = await db.collection('tourPackages').add({
      ...pkg,
      destinationId,
      discountPercent: pricing.discountPercent,
      discountPrice: pricing.discountPrice,
      effectivePrice: pricing.effectivePrice,
      hasDiscount: pricing.hasDiscount,
      imageUrls: entry.destination.imageUrls,
      isPublished: true,
      approvalStatus: 'approved',
      createdAt: now,
      updatedAt: now,
    });
    summary.packages++;
    console.log(`+ Package: ${pkg.name}`);

    // Departures
    for (const offset of DEPARTURE_OFFSETS) {
      const departureDate = addDaysToDateStr(today, offset);
      const departureTime = '07:00 AM';
      const bookingDeadlineHours = 24;
      await db.collection('departures').add({
        packageId: pkgRef.id,
        departureDate,
        returnDate: addDaysToDateStr(departureDate, pkg.durationDays - 1),
        departureTime,
        meetingPoint: entry.meetingPoint,
        bookingDeadlineHours,
        bookingDeadline: computeBookingDeadline(departureDate, departureTime, bookingDeadlineHours),
        capacity: 16,
        bookedCount: 0,
        assignedGuideId: null,
        status: 'open',
        operatorId: 'platform',
        createdAt: now,
        updatedAt: now,
      });
      summary.departures++;
    }
  }

  console.log('\nDone:', summary);
  process.exit(0);
}

seedMoreCatalog().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
