**IT 305W - Advance Web Applications**

**FINAL PROJECT CHECKLIST**

**Final Project Website Evaluation Checklist**

Both groups are building a website and will be evaluated based on three main user roles: Admin, Client/Customer, and Property Owner. This will help us to verify if you are building complete, functional systems rather than just attractive front-end designs. Both groups should demonstrate CRUD operations, authentication, role-based access, Firebase integration, responsive design, and a meaningful API Integration.

---

### GROUP 1: Tour-Reservation Website

#### A. Client/Traveler Side

| Module/Feature to Check | Expected Functionality                               |
| ----------------------- | ---------------------------------------------------- |
| **Homepage**            | Display featured tours, destinations, and promotions |

|
| **User Registration** | Create a traveler account

|
| **User Login/Logout** | Authenticate and end a session

|
| **Tour Listing** | Display available tour packages

|
| **Search and Filters** | Filter by destination, date, price and tour type

|
| **Tour Details** | Show itinerary, duration, inclusions, exclusions, and rules

|
| **Departure Schedule** | Display available dates, times, and slots

|
| **Reservation Form** | Select tour date and number of travelers

|
| **Price Calculation** | Calculate total based on travelers and applicable fees

|
| **My Bookings** | View reservation history and details

|
| **Booking Status** | Display pending, confirmed, cancelled, and completed bookings

|
| **Cancellation / Modifications** | Request changes subject to the tour policy

|
| **Payment/Confirmation** | Show payment status and booking reference

|
| **Reviews and Ratings** | Submit eligible reviews and view tour ratings

|
| **Traveler Profile** | Update personal and contact information

|
| **Notifications** | Display reservation updates and cancellation notices

|

---

#### B. Tour Operator / Organizer Side

| Module/Feature to Check   | Expected Functionality               |
| ------------------------- | ------------------------------------ |
| **Operator Registration** | Register or apply as a tour operator |

|
| **Operator Dashboard** | Display tour packages, reservations, and statistics

|
| **Add Tour Package** | Create a tour with its details and pricing

|
| **Edit Tour Package** | Update tour descriptions, itinerary, and details

|
| **Delete Tour Package** | Remove a package subject to booking restrictions

|
| **Image Upload** | Upload tour and destination photos

|
| **Departure Scheduling** | Set dates, times, meeting points, and deadlines

|
| **Capacity Management** | Set participant limits and track available slots

|
| **Reservation Management** | View and manage customer bookings

|
| **Traveler Manifest** | View the necessary participant list per departure

|
| **Pricing and Discounts** | Manage prices and supported discount options

|
| **Tour Status Management** | Mark tours scheduled, full, completed, or cancelled

|
| **Earnings and Reports** | Summarize bookings, participants, and revenue

|
| **Customer Feedback** | View reviews and ratings for managed tours

|

---

#### C. Administrator Side

| Module/Feature to Check | Expected Functionality                       |
| ----------------------- | -------------------------------------------- |
| **Admin Login**         | Restrict access to authorized administrators |

|
| **Admin Dashboard** | Display users, operators, tours, and reservations

|
| **User Management** | Search, view, and manage traveler accounts

|
| **Operator Management** | Approve, reject, or deactivate tour operators

|
| **Tour Package Management** | Approve, reject, hide, or remove tour packages

|
| **Reservation Monitoring** | View all reservations and booking statuses

|
| **Schedule Oversight** | Monitoring upcoming, full, and cancelled departures

|
| **Cancellation / Refund Monitoring** | Track requests and refund statuses

|
| **Review Moderation** | Handle inappropriate reviews and reports

|
| **Reports and Analytics** | Display booking and platform statistics

|
| **Destination Management** | Manage destinations, categories, and settings

|
| **Access Control** | Prevent unauthorized access to admin functions

|

---

#### D. Tour-Reservation-Specific System Rules

| Requirement to Test   | Expected Result                                  |
| --------------------- | ------------------------------------------------ |
| **Slot Availability** | Prevent reservation exceeding remaining capacity |

|
| **Concurrent Reservations** | Prevent overbooking when multiple users book simultaneously

|
| **Correct Price Calculation** | Calculate prices based on travelers and applicable fees

|
| **Operator Ownership** | Operators cannot modify another operator's tours

|
| **Booking Deadline** | Prevent bookings after the applicable deadline

|
| **Cancellation Handling** | Update reservation status and release slots according to policy

|
| **Tour Cancellation** | Notify affected customers and handle reservations appropriately

|
| **Review Eligibility** | Restrict reviews to eligible travelers who completed the tour

|
| **API Integration** | Demonstrate a working maps, geocoding, weather, or other relevant API

|
