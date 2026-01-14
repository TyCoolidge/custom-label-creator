const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const serverless = require("serverless-http");

const app = express();
const MONGODB_URI =
	process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/label_creator";
const DB_NAME = process.env.MONGODB_DB || "test";

let dbPromise;
function getDb() {
	if (!dbPromise) {
		const client = new MongoClient(MONGODB_URI);
		dbPromise = client.connect().then((c) => c.db(DB_NAME));
	}
	return dbPromise;
}

const defaultPresets = [
	{
		id: "default-1",
		name: "Baking Basics",
		ingredients: ["Flour", "Sugar", "Salt", "Baking Powder", "Baking Soda"],
	},
	{
		id: "default-2",
		name: "Spices",
		ingredients: ["Cinnamon", "Vanilla", "Nutmeg", "Ginger", "Cloves"],
	},
	{
		id: "default-3",
		name: "Dairy",
		ingredients: ["Butter", "Milk", "Eggs", "Heavy Cream", "Sour Cream"],
	},
	{
		id: "default-4",
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
		id: "default-5",
		name: "Chocolate",
		ingredients: [
			"Cocoa Powder",
			"Chocolate Chips",
			"Dark Chocolate",
			"White Chocolate",
		],
	},
	{
		id: "default-6",
		name: "Fruits",
		ingredients: ["Blueberries", "Strawberries", "Bananas", "Apples", "Lemons"],
	},
];

app.use(express.json());

// Static files (for local development)
const staticDir = path.join(__dirname, "..");
app.use(express.static(staticDir));
app.get("/", (req, res) => {
	res.sendFile(path.join(staticDir, "index.html"));
});

function stripMongoId(doc) {
	if (!doc) return doc;
	const { _id, ...rest } = doc;
	return { id: _id.toString(), ...rest };
}

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
		if (!result.value)
			return res.status(404).json({ error: "Label not found" });
		res.json(stripMongoId(result.value));
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
			presets = docs;
		}
		res.json(presets.map(stripMongoId));
	} catch (err) {
		console.error("GET /api/presets error", err);
		res.status(500).json({ error: "Failed to fetch presets" });
	}
});

app.post("/api/presets", async (req, res) => {
	try {
		const db = await getDb();
		const input = req.body || {};
		const preset = {
			id: input.id || Date.now().toString(),
			name: input.name || "",
			ingredients: input.ingredients || [],
			createdAt: new Date().toISOString(),
		};
		await db.collection("presets").insertOne(preset);
		res.status(201).json(preset);
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
		const result = await db
			.collection("presets")
			.findOneAndUpdate(
				{ id: req.params.id },
				{ $set: updates },
				{ returnDocument: "after" }
			);
		if (!result.value)
			return res.status(404).json({ error: "Preset not found" });
		res.json(stripMongoId(result.value));
	} catch (err) {
		console.error("PUT /api/presets/:id error", err);
		res.status(500).json({ error: "Failed to update preset" });
	}
});

app.delete("/api/presets/:id", async (req, res) => {
	try {
		const db = await getDb();
		const result = await db
			.collection("presets")
			.deleteOne({ id: req.params.id });
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

module.exports = serverless(app);
