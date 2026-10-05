import { Request, Response } from "express";
import { CoworkingSpace } from "../models/coworkingSpace.model";
import { z } from "zod";
import { ok, fail } from "../utils/http";
import { getCoordinatesFromAddress } from "../utils/geocoding";

const officeTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  pricePerSeat: z.number().min(0),
  capacity: z.number().min(1),
  images: z.array(z.string()).optional(),
});

const createCoworkingSpaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  images: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  officeTypes: z.array(officeTypeSchema).optional(),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateCoworkingSpaceSchema = createCoworkingSpaceSchema.partial();

export async function getAllCoworkingSpaces(req: Request, res: Response) {
  try {
    const spaces = await CoworkingSpace.find({})
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      ok(
        spaces.map((space) => ({
          id: space._id,
          name: space.name,
          description: space.description,
          location: space.location,
          city: space.city,
          state: space.state,
          country: space.country,
          latitude: space.latitude,
          longitude: space.longitude,
          images: space.images,
          amenities: space.amenities,
          officeTypes: space.officeTypes,
          rating: space.rating,
          ratingCount: space.ratingCount,
          isActive: space.isActive,
          createdBy: space.createdBy,
          createdAt: space.createdAt,
          updatedAt: space.updatedAt,
        }))
      )
    );
  } catch (error) {
    console.error("Error fetching coworking spaces:", error);
    return res.status(500).json(fail("Failed to fetch coworking spaces"));
  }
}

export async function getCoworkingSpaceById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const space = await CoworkingSpace.findById(id)
      .populate("createdBy", "name email")
      .lean();

    if (!space) {
      return res.status(404).json(fail("Coworking space not found"));
    }

    return res.json(
      ok({
        id: space._id,
        name: space.name,
        description: space.description,
        location: space.location,
        city: space.city,
        state: space.state,
        country: space.country,
        latitude: space.latitude,
        longitude: space.longitude,
        images: space.images,
        amenities: space.amenities,
        officeTypes: space.officeTypes,
        rating: space.rating,
        ratingCount: space.ratingCount,
        isActive: space.isActive,
        createdBy: space.createdBy,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
      })
    );
  } catch (error) {
    console.error("Error fetching coworking space:", error);
    return res.status(500).json(fail("Failed to fetch coworking space"));
  }
}

export async function createCoworkingSpace(req: Request, res: Response) {
  try {
    const parsed = createCoworkingSpaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(fail("Invalid input"));
    }

    const currentAdmin = (req as any).garageAdmin;
    const data = parsed.data;

    // Geocode the address if city, state, and country are provided
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (data.city && data.state && data.country) {
      const coordinates = await getCoordinatesFromAddress({
        streetAddress: data.location,
        city: data.city,
        state: data.state,
        country: data.country,
      });

      if (coordinates) {
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
      }
    }

    const space = await CoworkingSpace.create({
      ...data,
      latitude,
      longitude,
      createdBy: currentAdmin.id,
    });

    return res.status(201).json(
      ok({
        id: space._id,
        name: space.name,
        description: space.description,
        location: space.location,
        city: space.city,
        state: space.state,
        country: space.country,
        latitude: space.latitude,
        longitude: space.longitude,
        images: space.images,
        amenities: space.amenities,
        officeTypes: space.officeTypes,
        rating: space.rating,
        ratingCount: space.ratingCount,
        isActive: space.isActive,
        createdBy: space.createdBy,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
      })
    );
  } catch (error) {
    console.error("Error creating coworking space:", error);
    return res.status(500).json(fail("Failed to create coworking space"));
  }
}

export async function updateCoworkingSpace(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parsed = updateCoworkingSpaceSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json(fail("Invalid input"));
    }

    const data = parsed.data;

    // Geocode the address if city, state, and country are provided
    let updateData: any = { ...data };

    if (data.city && data.state && data.country) {
      const coordinates = await getCoordinatesFromAddress({
        streetAddress: data.location,
        city: data.city,
        state: data.state,
        country: data.country,
      });

      if (coordinates) {
        updateData.latitude = coordinates.latitude;
        updateData.longitude = coordinates.longitude;
      }
    }

    const space = await CoworkingSpace.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("createdBy", "name email")
      .lean();

    if (!space) {
      return res.status(404).json(fail("Coworking space not found"));
    }

    return res.json(
      ok({
        id: space._id,
        name: space.name,
        description: space.description,
        location: space.location,
        city: space.city,
        state: space.state,
        country: space.country,
        latitude: space.latitude,
        longitude: space.longitude,
        images: space.images,
        amenities: space.amenities,
        officeTypes: space.officeTypes,
        rating: space.rating,
        ratingCount: space.ratingCount,
        isActive: space.isActive,
        createdBy: space.createdBy,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
      })
    );
  } catch (error) {
    console.error("Error updating coworking space:", error);
    return res.status(500).json(fail("Failed to update coworking space"));
  }
}

export async function deleteCoworkingSpace(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const space = await CoworkingSpace.findByIdAndDelete(id).lean();

    if (!space) {
      return res.status(404).json(fail("Coworking space not found"));
    }

    return res.json(ok({ message: "Coworking space deleted successfully" }));
  } catch (error) {
    console.error("Error deleting coworking space:", error);
    return res.status(500).json(fail("Failed to delete coworking space"));
  }
}

export async function getUniqueOfficeTypes(req: Request, res: Response) {
  try {
    const officeTypes = await CoworkingSpace.aggregate([
      { $unwind: "$officeTypes" },
      { $group: { _id: "$officeTypes.name" } },
      { $sort: { _id: 1 } },
    ]);

    return res.json(ok(officeTypes.map((type) => type._id)));
  } catch (error) {
    console.error("Error fetching unique office types:", error);
    return res.status(500).json(fail("Failed to fetch office types"));
  }
}

// Public endpoint for founders/users - returns only active spaces
export async function getPublicCoworkingSpaces(req: Request, res: Response) {
  try {
    const spaces = await CoworkingSpace.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      ok(
        spaces.map((space) => ({
          id: space._id,
          name: space.name,
          description: space.description,
          location: space.location,
          city: space.city,
          state: space.state,
          country: space.country,
          latitude: space.latitude,
          longitude: space.longitude,
          images: space.images,
          amenities: space.amenities,
          officeTypes: space.officeTypes,
          rating: space.rating,
          ratingCount: space.ratingCount,
        }))
      )
    );
  } catch (error) {
    console.error("Error fetching public coworking spaces:", error);
    return res.status(500).json(fail("Failed to fetch coworking spaces"));
  }
}

// Public endpoint for founders/users - get single space by ID
export async function getPublicCoworkingSpaceById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const space = await CoworkingSpace.findOne({ _id: id, isActive: true }).lean();

    if (!space) {
      return res.status(404).json(fail("Coworking space not found"));
    }

    return res.json(
      ok({
        id: space._id,
        name: space.name,
        description: space.description,
        location: space.location,
        city: space.city,
        state: space.state,
        country: space.country,
        latitude: space.latitude,
        longitude: space.longitude,
        images: space.images,
        amenities: space.amenities,
        officeTypes: space.officeTypes,
        rating: space.rating,
        ratingCount: space.ratingCount,
      })
    );
  } catch (error) {
    console.error("Error fetching public coworking space:", error);
    return res.status(500).json(fail("Failed to fetch coworking space"));
  }
}
