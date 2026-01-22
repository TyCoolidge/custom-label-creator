require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const MONGODB_URI =
	process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/label_creator";
const DB_NAME = process.env.MONGODB_DB || "test";

let cachedDb = null;

function withTimeout(promise, ms) {
	const timeout = new Promise((_, reject) =>
		setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
	);
	return Promise.race([promise, timeout]);
}

async function getDb() {
	if (cachedDb) {
		return cachedDb;
	}
	console.log("Connecting to MongoDB...");
	const client = new MongoClient(MONGODB_URI, {
		serverSelectionTimeoutMS: 5000,
		connectTimeoutMS: 5000,
	});
	await withTimeout(client.connect(), 8000);
	console.log("MongoDB connected");
	cachedDb = client.db(DB_NAME);
	return cachedDb;
}

const defaultPresets = [
	{
		name: "Baking Basics",
		ingredients: ["Flour", "Sugar", "Salt", "Baking Powder", "Baking Soda"],
	},
	{
		name: "Spices",
		ingredients: ["Cinnamon", "Vanilla", "Nutmeg", "Ginger", "Cloves"],
	},
	{
		name: "Dairy",
		ingredients: ["Butter", "Milk", "Eggs", "Heavy Cream", "Sour Cream"],
	},
	{
		name: "Nuts & Seeds",
		ingredients: [
			"Almonds",
			"Walnuts",
			"Pecans",
			"Sunflower Seeds",
			"Chia Seeds",
		],
	},
	{
		name: "Chocolate",
		ingredients: [
			"Cocoa Powder",
			"Chocolate Chips",
			"Dark Chocolate",
			"White Chocolate",
		],
	},
	{
		name: "Fruits",
		ingredients: ["Blueberries", "Strawberries", "Bananas", "Apples", "Lemons"],
	},
];

app.use(express.json());

// Static files (for local development only)
if (process.env.NODE_ENV !== "production") {
	const path = require("path");
	const staticDir = path.join(__dirname, "..");
	app.use(express.static(staticDir));
	app.get("/", (req, res) => {
		res.sendFile(path.join(staticDir, "index.html"));
	});
}

function stripMongoId(doc) {
	if (!doc) return doc;
	const { _id, ...rest } = doc;
	return { id: _id.toString(), ...rest };
}

// Helper for backward compatibility - support both ObjectId and legacy custom id
function getPresetQuery(id) {
	try {
		// Try to parse as ObjectId (24 char hex string)
		if (ObjectId.isValid(id) && new ObjectId(id).toString() === id) {
			return { _id: new ObjectId(id) };
		}
	} catch {
		// Not a valid ObjectId, fall through to legacy query
	}
	// Fall back to legacy custom id field
	return { id: id };
}

// Test endpoint
app.get("/api/test", (req, res) => {
	console.log("Test endpoint hit");
	res.json({ ok: true, time: new Date().toISOString() });
});

// ===== LABELS =====
app.get("/api/labels", async (req, res) => {
	try {
		const db = await getDb();
		const labels = await db
			.collection("labels")
			.find({})
			.sort({ createdAt: 1 })
			.toArray();
		res.json(labels.map(stripMongoId));
	} catch (err) {
		console.error("GET /api/labels error", err);
		res.status(500).json({ error: "Failed to fetch labels" });
	}
});

app.post("/api/labels", async (req, res) => {
	try {
		const db = await getDb();
		const input = req.body || {};
		const now = new Date().toISOString();
		const label = {
			name: input.name || "",
			text: input.text || "",
			creationMode: input.creationMode || "manual",
			selectedPresetIds: input.selectedPresetIds || [],
			additionalIngredientsText: input.additionalIngredientsText || "",
			ingredients: input.ingredients || [],
			createdAt: input.createdAt || now,
			netQuantity: input.netQuantity || "",
			netQuantityUnit: input.netQuantityUnit || "oz",
			allergens: input.allergens || [],
			allergenDetails: input.allergenDetails || "",
			businessId: input.businessId || "",
			includeCottageDisclaimer: !!input.includeCottageDisclaimer,
		};
		await db.collection("labels").insertOne(label);
		res.status(201).json(stripMongoId(label));
	} catch (err) {
		console.error("POST /api/labels error", err);
		res.status(500).json({ error: "Failed to create label" });
	}
});

app.put("/api/labels/:id", async (req, res) => {
	try {
		const db = await getDb();
		const updates = {
			...(req.body || {}),
			updatedAt: new Date().toISOString(),
		};
		// Remove fields that shouldn't be updated
		delete updates._id;
		delete updates.id;
		const result = await db
			.collection("labels")
			.findOneAndUpdate(
				{ _id: new ObjectId(req.params.id) },
				{ $set: updates },
				{ returnDocument: "after" }
			);
		if (!result) return res.status(404).json({ error: "Label not found" });
		res.json(stripMongoId(result));
	} catch (err) {
		console.error("PUT /api/labels/:id error", err);
		res.status(500).json({ error: "Failed to update label" });
	}
});

app.delete("/api/labels/:id", async (req, res) => {
	try {
		const db = await getDb();
		const result = await db
			.collection("labels")
			.deleteOne({ _id: new ObjectId(req.params.id) });
		if (!result.deletedCount)
			return res.status(404).json({ error: "Label not found" });
		res.json({ success: true });
	} catch (err) {
		console.error("DELETE /api/labels/:id error", err);
		res.status(500).json({ error: "Failed to delete label" });
	}
});

// ===== PRESETS =====
app.get("/api/presets", async (req, res) => {
	try {
		const db = await getDb();
		const col = db.collection("presets");
		let presets = await col.find({}).sort({ createdAt: 1 }).toArray();
		if (presets.length === 0) {
			const now = new Date().toISOString();
			const docs = defaultPresets.map((p) => ({ ...p, createdAt: now }));
			await col.insertMany(docs);
			// Re-query to get the inserted documents with their _ids
			presets = await col.find({}).sort({ createdAt: 1 }).toArray();
		}
		res.json(presets.map(stripMongoId));
	} catch (err) {
		console.error("GET /api/presets error", err);
		res.status(500).json({ error: "Failed to fetch presets" });
	}
});

// Search presets by name, brandName, or ingredients
app.get("/api/presets/search", async (req, res) => {
	try {
		const db = await getDb();
		const col = db.collection("presets");
		const query = req.query.q || "";

		if (!query.trim()) {
			// Return all presets if no search query
			const presets = await col.find({}).sort({ createdAt: 1 }).toArray();
			return res.json(presets.map(stripMongoId));
		}

		// Case-insensitive partial match on name, brandName, or ingredients array
		const regex = { $regex: query.trim(), $options: "i" };
		const presets = await col
			.find({
				$or: [{ name: regex }, { brandName: regex }, { ingredients: regex }],
			})
			.sort({ createdAt: 1 })
			.toArray();

		res.json(presets.map(stripMongoId));
	} catch (err) {
		console.error("GET /api/presets/search error", err);
		res.status(500).json({ error: "Failed to search presets" });
	}
});

app.post("/api/presets", async (req, res) => {
	try {
		const db = await getDb();
		const input = req.body || {};
		const preset = {
			name: input.name || "",
			brandName: input.brandName || "",
			ingredients: input.ingredients || [],
			createdAt: new Date().toISOString(),
		};
		const result = await db.collection("presets").insertOne(preset);
		// Return the preset with the MongoDB-generated _id converted to id
		res.status(201).json(stripMongoId({ _id: result.insertedId, ...preset }));
	} catch (err) {
		console.error("POST /api/presets error", err);
		res.status(500).json({ error: "Failed to create preset" });
	}
});

app.put("/api/presets/:id", async (req, res) => {
	try {
		const db = await getDb();
		const updates = {
			...(req.body || {}),
			updatedAt: new Date().toISOString(),
		};
		// Remove id fields that shouldn't be updated
		delete updates._id;
		delete updates.id;
		// Use backward-compatible query (ObjectId or legacy custom id)
		const query = getPresetQuery(req.params.id);
		const result = await db
			.collection("presets")
			.findOneAndUpdate(query, { $set: updates }, { returnDocument: "after" });
		if (!result) return res.status(404).json({ error: "Preset not found" });
		res.json(stripMongoId(result));
	} catch (err) {
		console.error("PUT /api/presets/:id error", err);
		res.status(500).json({ error: "Failed to update preset" });
	}
});

app.delete("/api/presets/:id", async (req, res) => {
	try {
		const db = await getDb();
		// Use backward-compatible query (ObjectId or legacy custom id)
		const query = getPresetQuery(req.params.id);
		const result = await db.collection("presets").deleteOne(query);
		if (!result.deletedCount)
			return res.status(404).json({ error: "Preset not found" });
		res.json({ success: true });
	} catch (err) {
		console.error("DELETE /api/presets/:id error", err);
		res.status(500).json({ error: "Failed to delete preset" });
	}
});

// ===== BUSINESS INFO =====
function emptyBusiness() {
	return {
		businessName: "",
		businessAddress: "",
		businessCity: "",
		businessState: "",
		businessZip: "",
		businessPhone: "",
	};
}

app.get("/api/business", async (req, res) => {
	try {
		const db = await getDb();
		const doc = await db.collection("business").findOne({});
		res.json(doc ? stripMongoId(doc) : emptyBusiness());
	} catch (err) {
		console.error("GET /api/business error", err);
		res.status(500).json({ error: "Failed to fetch business info" });
	}
});

app.post("/api/business", async (req, res) => {
	try {
		const db = await getDb();
		const data = { ...emptyBusiness(), ...(req.body || {}) };
		await db.collection("business").replaceOne({}, data, { upsert: true });
		res.json(data);
	} catch (err) {
		console.error("POST /api/business error", err);
		res.status(500).json({ error: "Failed to save business info" });
	}
});

const port = process.env.PORT || 3000;
if (require.main === module) {
	app.listen(port, () => {
		console.log(`Label Creator server listening on http://localhost:${port}`);
	});
}

module.exports = app;
