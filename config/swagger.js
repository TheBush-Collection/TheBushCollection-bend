import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "The Bush Collection API",
      version: "1.0.0",
      description: "API documentation for the bush collection system ",
      contact: {
        name: "API Support",
        email: "pfdaniel77@gmail.com",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local server",
      },
      {
        url: "https://your-production-domain.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            fullName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            totalBookings: { type: "number" },
            totalSpent: { type: "number" },
            lastBooking: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["active", "inactive"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Admin: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Amenity: {
          type: "object",
          required: ["name", "price", "category"],
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
            description: { type: "string" },
            category: { type: "string", enum: ["Activity","Dining","Spa","Transport","Facility"] },
            duration: { type: "string" },
            availability: { type: "string", enum: ["Always available","Seasonal","On request"] },
            maxGuests: { type: "number" },
            forExternalGuests: { type: "boolean" },
            featured: { type: "boolean" },
            active: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Property: {
          type: "object",
          required: ["name"],
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            location: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["Lodge","Camp","Villa"] },
            basePricePerNight: { type: "number" },
            currency: { type: "string" },
            maxGuests: { type: "number" },
            rating: { type: "number" },
            numReviews: { type: "number" },
            amenities: { type: "array", items: { type: "string" } },
            images: { type: "array", items: { type: "string" } },
            videos: { type: "array", items: { type: "string" } },
            featured: { type: "boolean" },
            rooms: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Room: {
          type: "object",
          required: ["property","name","roomType"],
          properties: {
            _id: { type: "string" },
            property: { type: "string" },
            name: { type: "string" },
            roomType: { type: "string", enum: ["Tent","Suite","Family lodge","Luxury tent"] },
            pricePerNight: { type: "number" },
            currency: { type: "string" },
            maxGuests: { type: "number" },
            quantity: { type: "number" },
            description: { type: "string" },
            amenities: { type: "array", items: { type: "string" } },
            images: { type: "array", items: { type: "string" } },
            videos: { type: "array", items: { type: "string" } },
            availableForBooking: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Booking: {
          type: "object",
          required: ["bookingId", "bookingType", "customerName", "customerEmail", "customerPhone", "checkInDate", "checkOutDate", "totalGuests"],
          properties: {
            _id: { type: "string" },
            bookingId: { type: "string", description: "Unique booking identifier (e.g., BK1699876543ABC123)" },
            confirmationNumber: { type: "string", description: "Confirmation number for guest (e.g., SB1699876543XYZ)" },
            bookingType: { type: "string", enum: ["property", "package"], description: "Type of booking" },
            property: { type: "string", description: "Reference to Property ID" },
            package: { type: "string", description: "Reference to Package ID" },
            customerName: { type: "string" },
            customerEmail: { type: "string", format: "email" },
            customerPhone: { type: "string" },
            customerCountryCode: { type: "string" },
            checkInDate: { type: "string", format: "date" },
            checkOutDate: { type: "string", format: "date" },
            nights: { type: "number" },
            totalGuests: { type: "number" },
            adults: { type: "number" },
            children: { type: "number" },
            specialRequests: { type: "string" },
            rooms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  roomId: { type: "string" },
                  roomName: { type: "string" },
                  quantity: { type: "number" },
                  guests: { type: "number" },
                  pricePerNightPerPerson: { type: "number" },
                  subtotal: { type: "number" }
                }
              }
            },
            airportTransfer: {
              type: "object",
              properties: {
                needed: { type: "boolean" },
                arrivalDate: { type: "string", format: "date" },
                arrivalTime: { type: "string" },
                arrivalFlightNumber: { type: "string" },
                departureDate: { type: "string", format: "date" },
                departureTime: { type: "string" },
                departureFlightNumber: { type: "string" }
              }
            },
            amenities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  amenityId: { type: "string" },
                  amenityName: { type: "string" },
                  quantity: { type: "number" },
                  pricePerUnit: { type: "number" },
                  totalPrice: { type: "number" }
                }
              }
            },
            costs: {
              type: "object",
              properties: {
                basePrice: { type: "number" },
                amenitiesTotal: { type: "number" },
                subtotal: { type: "number" },
                serviceFee: { type: "number", description: "10% of subtotal" },
                taxes: { type: "number", description: "15% for property, 12% for package" },
                total: { type: "number" }
              }
            },
            paymentTerm: { type: "string", enum: ["deposit", "full"], description: "Payment option selected" },
            paymentSchedule: {
              type: "object",
              properties: {
                depositAmount: { type: "number" },
                balanceAmount: { type: "number" },
                depositDueDate: { type: "string", format: "date" },
                balanceDueDate: { type: "string", format: "date" }
              }
            },
            amountPaid: { type: "number", default: 0 },
            status: { type: "string", enum: ["pending", "deposit_paid", "confirmed", "fully_paid", "cancelled"], default: "pending" },
            paymentDetails: { type: "object", description: "PesaPal or other payment provider details" },
            notes: { type: "string" },
            internalNotes: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        BookingCreateRequest: {
          type: "object",
          required: ["bookingType", "customerName", "customerEmail", "customerPhone", "checkInDate", "checkOutDate", "totalGuests"],
          properties: {
            bookingType: { type: "string", enum: ["property", "package"] },
            propertyId: { type: "string", description: "Required for property bookings" },
            packageId: { type: "string", description: "Required for package bookings" },
            customerName: { type: "string" },
            customerEmail: { type: "string", format: "email" },
            customerPhone: { type: "string" },
            customerCountryCode: { type: "string" },
            checkInDate: { type: "string", format: "date" },
            checkOutDate: { type: "string", format: "date" },
            nights: { type: "number" },
            totalGuests: { type: "number" },
            adults: { type: "number" },
            children: { type: "number" },
            specialRequests: { type: "string" },
            rooms: {
              type: "array",
              items: {
                type: "object",
                required: ["roomId", "quantity"],
                properties: {
                  roomId: { type: "string" },
                  roomName: { type: "string" },
                  quantity: { type: "number" },
                  guests: { type: "number" },
                  pricePerNightPerPerson: { type: "number" },
                  subtotal: { type: "number" }
                }
              }
            },
            airportTransfer: {
              type: "object",
              properties: {
                needed: { type: "boolean" },
                arrivalDate: { type: "string", format: "date" },
                arrivalTime: { type: "string" },
                arrivalFlightNumber: { type: "string" },
                departureDate: { type: "string", format: "date" },
                departureTime: { type: "string" },
                departureFlightNumber: { type: "string" }
              }
            },
            amenities: {
              type: "array",
              items: {
                type: "object",
                required: ["amenityId"],
                properties: {
                  amenityId: { type: "string" },
                  amenityName: { type: "string" },
                  quantity: { type: "number" },
                  pricePerUnit: { type: "number" },
                  totalPrice: { type: "number" }
                }
              }
            },
            costs: {
              type: "object",
              required: ["basePrice", "subtotal", "serviceFee", "taxes", "total"],
              properties: {
                basePrice: { type: "number" },
                amenitiesTotal: { type: "number" },
                subtotal: { type: "number" },
                serviceFee: { type: "number" },
                taxes: { type: "number" },
                total: { type: "number" }
              }
            },
            paymentTerm: { type: "string", enum: ["deposit", "full"] },
            paymentSchedule: {
              type: "object",
              required: ["depositAmount", "balanceAmount"],
              properties: {
                depositAmount: { type: "number" },
                balanceAmount: { type: "number" },
                depositDueDate: { type: "string", format: "date" },
                balanceDueDate: { type: "string", format: "date" }
              }
            },
            amountPaid: { type: "number", default: 0 },
            notes: { type: "string" }
          }
        },
        Package: {
          type: "object",
          required: ["name","duration","location","price","category"],
          properties: {
            id: { type: "string", description: "Package ID (_id)" },
            _id: { type: "string", description: "MongoDB ID" },
            name: { type: "string", description: "Package name" },
            duration: { type: "string", description: "Duration (e.g., '3 Days', '5 Days')" },
            location: { type: "string", description: "Main location/destination" },
            accommodationProperty: { type: "string", description: "Reference to Property ID" },
            propertyId: { type: "string", description: "Property ID for accommodation" },
            shortDescription: { type: "string", description: "Brief overview of the package" },
            fullDescription: { type: "string", description: "Detailed description of the package" },
            category: {
              type: "string",
              enum: ["Wildlife","Photography","Luxury","Family","Adventure"],
              description: "Package category/type"
            },
            difficulty: {
              type: "string",
              enum: ["Easy","Moderate","Challenging"],
              default: "Easy",
              description: "Difficulty level of the safari"
            },
            maxGuests: { type: "number", description: "Maximum number of guests allowed" },
            groupSize: { type: "number", description: "Recommended group size" },
            mainImage: { type: "string", description: "Main image URL" },
            image: { type: "string", description: "Image URL (frontend field, mirrors mainImage)" },
            destinations: { type: "array", items: { type: "string" }, description: "List of destinations" },
            galleryImages: { type: "array", items: { type: "string" }, description: "Gallery images" },
            highlights: {
              type: "array",
              items: { type: "string" },
              description: "Key highlights and features of the package"
            },
            includes: {
              type: "array",
              items: { type: "string" },
              description: "What's included in the package"
            },
            excludes: {
              type: "array",
              items: { type: "string" },
              description: "What's not included in the package"
            },
            bestTimeToVisit: { type: "string", description: "Best season/months to visit" },
            price: { type: "number", description: "Current price per person in USD" },
            originalPrice: { type: "number", description: "Original price (before discount)" },
            rating: {
              type: "number",
              minimum: 0,
              maximum: 5,
              description: "Average rating (0-5)"
            },
            numberOfReviews: { type: "number", description: "Total number of reviews" },
            reviews: { type: "number", description: "Frontend field for review count" },
            featured: { type: "boolean", default: false, description: "Whether package is featured" },
            bookingCount: { type: "number", default: 0, description: "Total bookings for this package" },
            itinerary: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dayNumber: { type: "number", description: "Day number in itinerary" },
                  title: { type: "string", description: "Day title/theme" },
                  description: { type: "string", description: "Detailed description of the day" },
                  activities: { type: "array", items: { type: "string" }, description: "Activities for the day" },
                  image: { type: "string", description: "Image for this day" }
                }
              },
              description: "Day-by-day itinerary"
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        PackageCreateRequest: {
          type: "object",
          required: ["name","duration","location","price","category"],
          properties: {
            name: { type: "string" },
            duration: { type: "string" },
            location: { type: "string" },
            accommodationProperty: { type: "string", description: "Property ID for accommodation" },
            propertyId: { type: "string", description: "Property ID for accommodation (alternative)" },
            shortDescription: { type: "string" },
            fullDescription: { type: "string" },
            category: { type: "string", enum: ["Wildlife","Photography","Luxury","Family","Adventure"] },
            difficulty: { type: "string", enum: ["Easy","Moderate","Challenging"] },
            maxGuests: { type: "number" },
            groupSize: { type: "number" },
            mainImage: { type: "string" },
            image: { type: "string" },
            destinations: { type: "array", items: { type: "string" } },
            galleryImages: { type: "array", items: { type: "string" } },
            highlights: { type: "array", items: { type: "string" } },
            includes: { type: "array", items: { type: "string" } },
            excludes: { type: "array", items: { type: "string" } },
            bestTimeToVisit: { type: "string" },
            price: { type: "number" },
            originalPrice: { type: "number" },
            rating: { type: "number" },
            numberOfReviews: { type: "number" },
            featured: { type: "boolean" },
            itinerary: { type: "array", items: { type: "object" } },
          },
        },
        Media: {
          type: "object",
          required: ["title","type"],
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            type: { type: "string", enum: ["image","video"] },
            category: { type: "string" },
            thumbnailUrl: { type: "string" },
            description: { type: "string" },
            featured: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        NairobiHotel: {
          type: "object",
          required: ["name"],
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            location: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["Lodge","Villa","Tented Camp","Luxury camp"] },
            priceUSD: { type: "number" },
            rating: { type: "number" },
            numReviews: { type: "number" },
            amenities: { type: "array", items: { type: "string" } },
            images: { type: "array", items: { type: "string" } },
            bookable: { type: "boolean" },
            rooms: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
          Review: {
            type: "object",
            required: ["rating"],
            properties: {
              _id: { type: "string" },
              user: { type: "string", description: "User ID (ObjectId reference)" },
              user_name: { type: "string", description: "Name of the reviewer" },
              user_email: { type: "string", format: "email", description: "Email of the reviewer" },
              property: { type: "string", description: "Property ID (ObjectId reference)" },
              property_name: { type: "string", description: "Name of the property" },
              package: { type: "string", description: "Package ID (ObjectId reference)" },
              package_name: { type: "string", description: "Name of the package" },
              booking: { type: "string", description: "Booking ID (ObjectId reference)" },
              rating: { type: "number", minimum: 1, maximum: 5, description: "Rating from 1 to 5" },
              title: { type: "string", maxLength: 200, description: "Review title" },
              comment: { type: "string", maxLength: 5000, description: "Review comment/description" },
              is_approved: { type: "boolean", default: false, description: "Admin approval status" },
              is_featured: { type: "boolean", default: false, description: "Featured on homepage/property" },
              admin_notes: { type: "string", description: "Internal notes from admin" },
              helpful_count: { type: "number", default: 0, description: "Number of helpful votes" },
              unhelpful_count: { type: "number", default: 0, description: "Number of unhelpful votes" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          },
          ReviewInput: {
            type: "object",
            required: ["rating"],
            properties: {
              user_id: { type: "string", description: "User ID (optional)" },
              user_name: { type: "string", description: "Name of the reviewer" },
              user_email: { type: "string", format: "email", description: "Email of the reviewer" },
              property_id: { type: "string", description: "Property ID (one of property_id or package_id required)" },
              package_id: { type: "string", description: "Package ID (one of property_id or package_id required)" },
              booking_id: { type: "string", description: "Booking ID (optional)" },
              rating: { type: "number", minimum: 1, maximum: 5, description: "Rating from 1 to 5" },
              title: { type: "string", description: "Review title" },
              comment: { type: "string", description: "Review comment" }
            }
          },
          Contact: {
            type: "object",
            required: ["fullName", "email", "message"],
            properties: {
              _id: { type: "string" },
              fullName: { type: "string" },
              email: { type: "string", format: "email" },
              phone: { type: "string" },
              subject: { type: "string", enum: ["General enquiry","Booking Question","Custom Safari request","Group booking","Customer support"] },
              preferredTravelDates: { type: "string" },
              groupSize: { type: "string", enum: ["1 person","2 people","3-4 people","5-8 people","9+ people"] },
              safariInterests: { type: "string" },
              message: { type: "string" },
              subscribedToMailchimp: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          },
          PaymentInitResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              redirectUrl: { type: "string" },
              orderTrackingId: { type: "string" }
            }
          },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./routes/*.js", // all route files
    "./models/*.js", // optional for schema definitions
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
