-- ============================================================
-- TOUR MODULE TABLES - Multi-Tenant Version
-- Every table includes company_id for tenant isolation.
-- Unique constraints are scoped per company, not globally.
-- ============================================================

-- ============================================================
-- ENUMS (only create if they don't already exist)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'inquiry', 'quote_sent', 'confirmed', 'deposit_paid',
    'fully_paid', 'in_progress', 'completed', 'cancelled', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_status AS ENUM (
    'available', 'on_trip', 'maintenance', 'retired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- DESTINATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Uganda',
  region VARCHAR(100),
  description TEXT,
  highlights TEXT[],
  best_time_to_visit VARCHAR(255),
  typical_duration_days INT,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_company ON destinations(company_id);
CREATE INDEX IF NOT EXISTS idx_destinations_country ON destinations(company_id, country);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON destinations(company_id, is_active);

-- ============================================================
-- TOUR PACKAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS tour_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_days INT NOT NULL,
  duration_nights INT NOT NULL,

  -- Pricing
  base_price_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
  base_price_eur DECIMAL(15,2) DEFAULT 0,
  base_price_ugx DECIMAL(15,2) DEFAULT 0,
  price_per_person BOOLEAN DEFAULT true,
  min_group_size INT DEFAULT 1,
  max_group_size INT DEFAULT 20,

  -- Details
  tour_type VARCHAR(100),
  difficulty_level VARCHAR(50) DEFAULT 'moderate',
  inclusions TEXT,
  exclusions TEXT,

  primary_destination_id UUID REFERENCES destinations(id),
  image_url VARCHAR(500),
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, package_code)
);

CREATE INDEX IF NOT EXISTS idx_tour_packages_company ON tour_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_tour_packages_active ON tour_packages(company_id, is_active);

-- Tour package destinations (many-to-many)
CREATE TABLE IF NOT EXISTS tour_package_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id),
  visit_order INT NOT NULL DEFAULT 1,
  nights_stay INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tour_package_id, destination_id)
);

-- Daily itinerary for tour packages
CREATE TABLE IF NOT EXISTS tour_itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  activities TEXT[],
  meals_included VARCHAR(50),
  accommodation VARCHAR(255),
  destination_id UUID REFERENCES destinations(id),
  distance_km DECIMAL(10,2),
  driving_hours DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tour_package_id, day_number)
);

-- Seasonal pricing
CREATE TABLE IF NOT EXISTS tour_seasonal_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  season_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_adjustment_percent DECIMAL(5,2) DEFAULT 0,
  price_adjustment_fixed_usd DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_season_dates CHECK (end_date >= start_date)
);

-- ============================================================
-- HOTELS
-- ============================================================

CREATE TABLE IF NOT EXISTS hotels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  destination_id UUID REFERENCES destinations(id),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),

  star_rating INT CHECK (star_rating >= 1 AND star_rating <= 5),
  hotel_type VARCHAR(100),

  standard_rate_usd DECIMAL(15,2),
  deluxe_rate_usd DECIMAL(15,2),
  suite_rate_usd DECIMAL(15,2),

  contact_person VARCHAR(255),
  contact_phone VARCHAR(50),
  commission_rate DECIMAL(5,2) DEFAULT 10,

  notes TEXT,
  is_partner BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotels_company ON hotels(company_id);
CREATE INDEX IF NOT EXISTS idx_hotels_active ON hotels(company_id, is_active);

-- Room types
CREATE TABLE IF NOT EXISTS hotel_room_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_occupancy INT DEFAULT 2,
  rate_usd DECIMAL(15,2) NOT NULL,
  rate_ugx DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BOOKINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),

  booking_type VARCHAR(50) NOT NULL DEFAULT 'tour', -- tour, hotel, car_hire, custom
  tour_package_id UUID REFERENCES tour_packages(id),

  -- Dates
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  travel_start_date DATE NOT NULL,
  travel_end_date DATE NOT NULL,

  -- Group
  num_adults INT NOT NULL DEFAULT 1,
  num_children INT DEFAULT 0,
  num_infants INT DEFAULT 0,

  -- Pricing
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,

  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,

  status booking_status DEFAULT 'inquiry',

  special_requests TEXT,
  dietary_requirements TEXT,

  assigned_guide_id UUID REFERENCES user_profiles(id),
  assigned_vehicle_id UUID, -- references vehicles(id), no FK to avoid circular dep

  -- Links to invoices (optional)
  invoice_id UUID, -- references invoices(id)
  quotation_id UUID, -- references invoices(id)

  hotel_id UUID REFERENCES hotels(id),

  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_travel_dates CHECK (travel_end_date >= travel_start_date),
  UNIQUE(company_id, booking_number)
);

CREATE INDEX IF NOT EXISTS idx_bookings_company ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(company_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(company_id, travel_start_date, travel_end_date);

-- Booking guests
CREATE TABLE IF NOT EXISTS booking_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  nationality VARCHAR(100),
  passport_number VARCHAR(50),
  passport_expiry DATE,
  date_of_birth DATE,
  is_lead_guest BOOLEAN DEFAULT false,
  special_requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_guests_booking ON booking_guests(booking_id);

-- Booking hotel reservations
CREATE TABLE IF NOT EXISTS booking_hotels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  room_type_id UUID REFERENCES hotel_room_types(id),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  num_rooms INT DEFAULT 1,
  room_rate DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  confirmation_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_hotel_dates CHECK (check_out_date > check_in_date)
);

-- Booking activities / add-ons
CREATE TABLE IF NOT EXISTS booking_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,
  num_participants INT DEFAULT 1,
  unit_cost DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  permit_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking payments
CREATE TABLE IF NOT EXISTS booking_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  payment_type VARCHAR(50) DEFAULT 'deposit', -- deposit, balance, refund
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FLEET / VEHICLES
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_number VARCHAR(50) NOT NULL,
  registration_number VARCHAR(50) NOT NULL,

  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT,
  color VARCHAR(50),
  vehicle_type VARCHAR(100),
  fuel_type VARCHAR(50) DEFAULT 'diesel',
  transmission VARCHAR(50) DEFAULT 'manual',

  seating_capacity INT NOT NULL DEFAULT 4,
  luggage_capacity VARCHAR(100),
  features TEXT[],

  purchase_date DATE,
  purchase_price DECIMAL(15,2),
  current_value DECIMAL(15,2),
  insurance_expiry DATE,

  daily_rate_usd DECIMAL(15,2),
  daily_rate_ugx DECIMAL(15,2),
  weekly_rate_usd DECIMAL(15,2),
  mileage_rate DECIMAL(10,2),

  status vehicle_status DEFAULT 'available',
  current_mileage INT DEFAULT 0,
  last_service_date DATE,
  next_service_mileage INT,

  location VARCHAR(100),
  fixed_asset_id UUID REFERENCES fixed_assets(id),

  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, vehicle_number),
  UNIQUE(company_id, registration_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(company_id, status);

-- Vehicle maintenance
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL,
  maintenance_type VARCHAR(100) NOT NULL,
  description TEXT,
  mileage_at_service INT,
  cost DECIMAL(15,2),
  vendor_id UUID REFERENCES vendors(id),
  performed_by VARCHAR(255),
  next_service_date DATE,
  next_service_mileage INT,
  receipt_url VARCHAR(500),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle ON vehicle_maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_date ON vehicle_maintenance(maintenance_date);

-- Car rentals
CREATE TABLE IF NOT EXISTS car_rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rental_number VARCHAR(50) NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  booking_id UUID REFERENCES bookings(id),

  pickup_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ NOT NULL,
  actual_return_date TIMESTAMPTZ,

  pickup_location VARCHAR(255),
  return_location VARCHAR(255),

  with_driver BOOLEAN DEFAULT true,
  driver_id UUID REFERENCES user_profiles(id),

  start_mileage INT,
  end_mileage INT,
  mileage_limit INT,
  extra_mileage_rate DECIMAL(10,2),

  daily_rate DECIMAL(15,2) NOT NULL,
  num_days INT NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  extras_total DECIMAL(15,2) DEFAULT 0,
  fuel_charge DECIMAL(15,2) DEFAULT 0,
  damage_charge DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,

  currency CHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'reserved',

  insurance_option VARCHAR(100),
  insurance_cost DECIMAL(15,2) DEFAULT 0,

  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, rental_number)
);

CREATE INDEX IF NOT EXISTS idx_car_rentals_company ON car_rentals(company_id);
CREATE INDEX IF NOT EXISTS idx_car_rentals_vehicle ON car_rentals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_car_rentals_dates ON car_rentals(pickup_date, return_date);
