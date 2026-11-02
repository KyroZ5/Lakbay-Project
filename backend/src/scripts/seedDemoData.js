import 'dotenv/config';
import { db, isFirebaseInitialized } from '../config/firebaseAdmin.js';

const DEMO_DESTINATIONS = [
  {
    name: 'El Nido',
    country: 'Philippines',
    region: 'MIMAROPA',
    location: 'Palawan, Philippines',
    coordinates: { lat: 11.1956, lng: 119.4075 },
    category: 'Island',
    description: 'Renowned for dramatic limestone karst cliffs, hidden turquoise lagoons, powdery white-sand beaches, and vibrant coral reefs.',
    recommendedActivities: ['Island Hopping Tour A', 'Kayaking in Big Lagoon', 'Sunset at Las Cabañas', 'Scuba Diving'],
    imageUrls: [
      'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
    ],
    isPublished: true,
    isFeatured: true,
  },
  {
    name: 'Coron',
    country: 'Philippines',
    region: 'MIMAROPA',
    location: 'Palawan, Philippines',
    coordinates: { lat: 12.0000, lng: 120.2000 },
    category: 'Island',
    description: 'World-famous for crystal-clear Kayangan Lake, Twin Lagoon, and historic WWII Japanese shipwrecks enveloped in marine life.',
    recommendedActivities: ['Kayangan Lake Trek', 'Twin Lagoon Swimming', 'Shipwreck Snorkeling', 'Maquinit Hot Spring'],
    imageUrls: [
      'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    ],
    isPublished: true,
    isFeatured: true,
  },
  {
    name: 'Siargao Island',
    country: 'Philippines',
    region: 'Caraga',
    location: 'Surigao del Norte, Philippines',
    coordinates: { lat: 9.8569, lng: 126.0469 },
    category: 'Beach',
    description: 'The surfing capital of the Philippines with rolling ocean swells at Cloud 9, tranquil tidal rock pools, and lush palm-fringed rivers.',
    recommendedActivities: ['Cloud 9 Surfing', 'Magpupungko Rock Pools', 'Sugba Lagoon Paddleboarding', 'Coconut Tree River Rope Swing'],
    imageUrls: [
      'https://images.unsplash.com/photo-1534008897995-27a23e859048?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    ],
    isPublished: true,
    isFeatured: true,
  },
  {
    name: 'Batanes',
    country: 'Philippines',
    region: 'Cagayan Valley',
    location: 'Batanes Province, Philippines',
    coordinates: { lat: 20.4485, lng: 121.9708 },
    category: 'Heritage',
    description: 'The northernmost frontier featuring rolling emerald hills, traditional Ivatan stone houses, lighthouses overlooking crashing Pacific waves.',
    recommendedActivities: ['Marlboro Hills Trek', 'Basco Lighthouse Sunset', 'Ivatan Stone House Tour', 'Sabtang Island Boat Crossing'],
    imageUrls: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    ],
    isPublished: true,
    isFeatured: true,
  },
  {
    name: 'Bohol',
    country: 'Philippines',
    region: 'Central Visayas',
    location: 'Bohol, Philippines',
    coordinates: { lat: 9.8500, lng: 124.1435 },
    category: 'Nature',
    description: 'Home of the geological wonder Chocolate Hills, the endangered Philippine Tarsier sanctuary, and the scenic Loboc River cruise.',
    recommendedActivities: ['Chocolate Hills Viewpoint', 'Tarsier Sanctuary Visit', 'Loboc River Buffet Cruise', 'Balicasag Dolphin Watching'],
    imageUrls: [
      'https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1200&q=80',
    ],
    isPublished: true,
    isFeatured: false,
  },
];

async function seedDemoData() {
  console.log('====================================================');
  console.log('      LAKBAY PLATFORM - DEMO CATALOG SEEDER         ');
  console.log('====================================================');

  if (!isFirebaseInitialized || !db) {
    console.error('❌ Firebase Admin is not initialized.');
    process.exit(1);
  }

  const now = new Date().toISOString();

  try {
    // 1. Seed Destinations
    console.log('Seeding destinations...');
    const destinationMap = new Map();

    for (const dest of DEMO_DESTINATIONS) {
      const existing = await db.collection('destinations').where('name', '==', dest.name).limit(1).get();
      let destId;

      if (existing.empty) {
        const docRef = await db.collection('destinations').add({
          ...dest,
          createdAt: now,
          updatedAt: now,
        });
        destId = docRef.id;
        console.log(`+ Created destination: ${dest.name} (${destId})`);
      } else {
        destId = existing.docs[0].id;
        await existing.docs[0].ref.update({ ...dest, updatedAt: now });
        console.log(`* Updated destination: ${dest.name} (${destId})`);
      }
      destinationMap.set(dest.name, destId);
    }

    // 2. Seed Tour Packages
    console.log('\nSeeding tour packages and itineraries...');
    const elNidoId = destinationMap.get('El Nido');
    const coronId = destinationMap.get('Coron');
    const siargaoId = destinationMap.get('Siargao Island');
    const batanesId = destinationMap.get('Batanes');

    const packages = [
      {
        name: 'El Nido Island Hopping & Hidden Lagoons',
        destinationId: elNidoId,
        category: 'Island Hopping',
        description: 'Experience the crown jewel of Palawan with 4 days of idyllic island hopping, snorkeling in pristine coral gardens, and kayaking through dramatic limestone lagoons.',
        pricePerPerson: 14500,
        durationDays: 4,
        durationNights: 3,
        cancellationCutoffDays: 7,
        inclusions: [
          '3 Nights Beachfront Resort Accommodation',
          'Licensed Tour Guide & Environmental Fees',
          'Private Island Hopping Boat (Tour A & C)',
          'Buffet Seafood Lunch on Island Stops',
          'Roundtrip Airport Van Transfers',
        ],
        exclusions: ['Roundtrip Airfare to Puerto Princesa/El Nido', 'Personal Souvenirs & Gratuities'],
        accommodationDetails: 'Standard air-conditioned beachfront resort room with daily breakfast included.',
        transportDetails: 'Air-conditioned tourist van and motorized outrigger banca boat.',
        imageUrls: [
          'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
        ],
        itinerary: [
          {
            dayNumber: 1,
            dayTitle: 'Arrival, Check-in & Nacpan Beach Sunset',
            activities: [
              {
                timeSlot: '01:00 PM',
                activityName: 'Van Pick-up & Resort Check-in',
                locationName: 'Lio Airport / El Nido Town',
                coordinates: { lat: 11.2008, lng: 119.4178 },
                description: 'Pick up from airport and check-in to your resort with welcome drinks.',
              },
              {
                timeSlot: '04:00 PM',
                activityName: 'Nacpan Beach Golden Hour',
                locationName: 'Nacpan Beach',
                coordinates: { lat: 11.3195, lng: 119.4277 },
                description: 'Relax along the famous 4-kilometer twin stretch of golden sand.',
              },
            ],
          },
          {
            dayNumber: 2,
            dayTitle: 'Tour A: Big Lagoon & Secret Sanctuary',
            activities: [
              {
                timeSlot: '08:30 AM',
                activityName: 'Big Lagoon Kayaking',
                locationName: 'Big Lagoon, Miniloc Island',
                coordinates: { lat: 11.1558, lng: 119.3142 },
                description: 'Paddle through emerald waters surrounded by towering vertical limestone cliffs.',
              },
              {
                timeSlot: '12:00 PM',
                activityName: 'Shimizu Island Grilled Seafood Lunch',
                locationName: 'Shimizu Island',
                coordinates: { lat: 11.1417, lng: 119.3192 },
                description: 'Fresh grilled fish, pork, prawns, and tropical fruits prepared right on the boat.',
              },
              {
                timeSlot: '02:30 PM',
                activityName: 'Secret Lagoon Exploration',
                locationName: 'Secret Lagoon',
                coordinates: { lat: 11.1492, lng: 119.3108 },
                description: 'Crawl through a small opening in the rock to discover a secluded pool.',
              },
            ],
          },
          {
            dayNumber: 3,
            dayTitle: 'Tour C: Hidden Beach & Matinloc Shrine',
            activities: [
              {
                timeSlot: '09:00 AM',
                activityName: 'Hidden Beach Swim',
                locationName: 'Hidden Beach, Matinloc Island',
                coordinates: { lat: 11.2025, lng: 119.2883 },
                description: 'Swim through a shallow crevice into an enclosed bay of calm turquoise water.',
              },
              {
                timeSlot: '01:30 PM',
                activityName: 'Matinloc Shrine Viewpoint',
                locationName: 'Matinloc Island',
                coordinates: { lat: 11.1894, lng: 119.2997 },
                description: 'Climb the limestone stairs for panoramic views across the Tapiutan Strait.',
              },
            ],
          },
          {
            dayNumber: 4,
            dayTitle: 'Souvenir Shopping & Homeward Bound',
            activities: [
              {
                timeSlot: '10:00 AM',
                activityName: 'Local Crafts Market & Checkout',
                locationName: 'El Nido Poblacion',
                coordinates: { lat: 11.1800, lng: 119.3900 },
                description: 'Browse handmade souvenirs, dried mangoes, and cashew delicacies before airport drop-off.',
              },
            ],
          },
        ],
        isPublished: true,
        isFeatured: true,
      },
      {
        name: 'Coron Shipwrecks, Coral Gardens & Lakes',
        destinationId: coronId,
        category: 'Adventure',
        description: 'Explore the submerged history of Coron Bay, swim in the cleanest lake in Asia (Kayangan Lake), and soak in natural saltwater hot springs.',
        pricePerPerson: 12800,
        durationDays: 3,
        durationNights: 2,
        cancellationCutoffDays: 7,
        inclusions: [
          '2 Nights Hotel Accommodation',
          'Coron Ultimate Island Hopping Tour',
          'Snorkeling Gear & Life Vests',
          'Buffet Lunch on Island',
          'Maquinit Hot Springs Evening Pass',
        ],
        exclusions: ['Airfare', 'Incidentals'],
        accommodationDetails: 'Modern boutique hotel in Coron Town proper.',
        transportDetails: 'Private boat and air-conditioned shuttle transfers.',
        imageUrls: [
          'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?auto=format&fit=crop&w=1200&q=80',
        ],
        itinerary: [
          {
            dayNumber: 1,
            dayTitle: 'Arrival & Maquinit Hot Spring',
            activities: [
              {
                timeSlot: '02:00 PM',
                activityName: 'Hotel Check-in',
                locationName: 'Coron Town',
                coordinates: { lat: 12.0000, lng: 120.2000 },
                description: 'Arrive in Coron and settle in.',
              },
              {
                timeSlot: '05:30 PM',
                activityName: 'Maquinit Saltwater Hot Spring Bath',
                locationName: 'Maquinit Springs',
                coordinates: { lat: 11.9933, lng: 120.2392 },
                description: 'Relax in therapeutic 40°C mineral hot springs while gazing at the stars.',
              },
            ],
          },
          {
            dayNumber: 2,
            dayTitle: 'Kayangan Lake, Twin Lagoon & Shipwreck',
            activities: [
              {
                timeSlot: '09:00 AM',
                activityName: 'Kayangan Lake Trek & Swim',
                locationName: 'Kayangan Lake',
                coordinates: { lat: 11.9567, lng: 120.2239 },
                description: 'Trek up to the iconic vantage point and swim in 90% freshwater crystal clarity.',
              },
              {
                timeSlot: '01:30 PM',
                activityName: 'Skeleton Wreck & Coral Reef Snorkeling',
                locationName: 'Skeleton Wreck',
                coordinates: { lat: 11.9681, lng: 120.2069 },
                description: 'Snorkel over a historic WWII shipwreck teeming with tropical reef fish.',
              },
            ],
          },
          {
            dayNumber: 3,
            dayTitle: 'Mt. Tapyas Viewpoint & Departure',
            activities: [
              {
                timeSlot: '06:00 AM',
                activityName: 'Mt. Tapyas Sunrise Hike',
                locationName: 'Mt. Tapyas, Coron',
                coordinates: { lat: 12.0050, lng: 120.2033 },
                description: 'Climb 721 steps for an inspiring sunrise view over the entire Calamianes Archipelago.',
              },
            ],
          },
        ],
        isPublished: true,
        isFeatured: true,
      },
      {
        name: 'Siargao Surf, Rock Pools & Island Odyssey',
        destinationId: siargaoId,
        category: 'Beach',
        description: 'Ride the gentle waves of Cloud 9, plunge into turquoise lagoons, and cruise past thousands of coconut palms on the ultimate tropical adventure.',
        pricePerPerson: 18500,
        durationDays: 5,
        durationNights: 4,
        cancellationCutoffDays: 7,
        inclusions: [
          '4 Nights Tropical Eco-Resort Stay',
          'Surf Lesson with Certified Local Instructor',
          'Tri-Island Tour (Naked, Daku, Guyam Islands)',
          'Sugba Lagoon Kayak Tour',
          'Daily Breakfast & Island Lunches',
        ],
        exclusions: ['Flights to Sayak Airport', 'Board Rentals outside lessons'],
        accommodationDetails: 'Eco-bungalow within walking distance of General Luna nightlife and beach.',
        transportDetails: 'Motorcycle rental option or private open-air safari van.',
        imageUrls: [
          'https://images.unsplash.com/photo-1534008897995-27a23e859048?auto=format&fit=crop&w=1200&q=80',
        ],
        itinerary: [
          {
            dayNumber: 1,
            dayTitle: 'Arrival & Sunset at Cloud 9 Boardwalk',
            activities: [
              {
                timeSlot: '04:30 PM',
                activityName: 'Cloud 9 Boardwalk Walk',
                locationName: 'Cloud 9, General Luna',
                coordinates: { lat: 9.8164, lng: 126.1664 },
                description: 'Watch professional surfers carve the waves from the 3-story wooden viewing deck.',
              },
            ],
          },
        ],
        isPublished: true,
        isFeatured: true,
      },
      {
        name: 'Batanes Breathtaking Heritage & Rolling Hills',
        destinationId: batanesId,
        category: 'Heritage',
        description: 'Discover the windswept grandeur of Batanes, where dramatic coastal cliffs meet the timeless warmth of Ivatan stone-house villages.',
        pricePerPerson: 26000,
        durationDays: 4,
        durationNights: 3,
        cancellationCutoffDays: 14,
        inclusions: [
          '3 Nights Ivatan Homestay/Lodge',
          'North & South Batan Guided Tours',
          'Sabtang Island Cultural Expedition',
          'All Municipal Environmental Permits',
          'Traditional Ivatan Culinary Feasts',
        ],
        exclusions: ['Airfare to Basco', 'Personal expenses'],
        accommodationDetails: 'Charming heritage lodge with hot water and traditional breakfast.',
        transportDetails: 'Air-conditioned van and traditional faluwa boat to Sabtang.',
        imageUrls: [
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        ],
        itinerary: [
          {
            dayNumber: 1,
            dayTitle: 'Basco Town & Lighthouses',
            activities: [
              {
                timeSlot: '02:00 PM',
                activityName: 'Basco Lighthouse & Naidi Hills',
                locationName: 'Basco Lighthouse',
                coordinates: { lat: 20.4578, lng: 121.9642 },
                description: 'Marvel at 360-degree vistas of the West Philippine Sea and Mount Iraya.',
              },
            ],
          },
        ],
        isPublished: true,
        isFeatured: true,
      },
    ];

    const packageIds = [];
    for (const pkg of packages) {
      if (!pkg.destinationId) continue;
      const existing = await db.collection('tourPackages').where('name', '==', pkg.name).limit(1).get();
      let pkgId;

      if (existing.empty) {
        const docRef = await db.collection('tourPackages').add({
          ...pkg,
          createdAt: now,
          updatedAt: now,
        });
        pkgId = docRef.id;
        console.log(`+ Created package: ${pkg.name} (${pkgId})`);
      } else {
        pkgId = existing.docs[0].id;
        await existing.docs[0].ref.update({ ...pkg, updatedAt: now });
        console.log(`* Updated package: ${pkg.name} (${pkgId})`);
      }
      packageIds.push({ id: pkgId, ...pkg });
    }

    // 3. Seed Future Open Departures
    console.log('\nSeeding future departure schedules...');
    const today = new Date();

    for (const pkg of packageIds) {
      // Create 3 upcoming departure schedules for each package: +7 days, +21 days, +35 days
      const offsets = [7, 21, 35];
      for (const offset of offsets) {
        const depDate = new Date(today);
        depDate.setDate(today.getDate() + offset);
        const depDateStr = depDate.toISOString().split('T')[0];

        const retDate = new Date(depDate);
        retDate.setDate(depDate.getDate() + (pkg.durationDays - 1));
        const retDateStr = retDate.toISOString().split('T')[0];

        const existing = await db
          .collection('departures')
          .where('packageId', '==', pkg.id)
          .where('departureDate', '==', depDateStr)
          .limit(1)
          .get();

        if (existing.empty) {
          await db.collection('departures').add({
            packageId: pkg.id,
            departureDate: depDateStr,
            returnDate: retDateStr,
            capacity: 15,
            bookedCount: 0,
            assignedGuideId: null,
            status: 'open',
            createdAt: now,
            updatedAt: now,
          });
          console.log(`+ Added departure for ${pkg.name}: ${depDateStr} to ${retDateStr} (Slots: 15)`);
        }
      }
    }

    console.log('----------------------------------------------------');
    console.log('✅ Demo Catalog Seeding Completed Successfully!');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('❌ Failed to seed demo catalog:', error);
  }
}

seedDemoData();
