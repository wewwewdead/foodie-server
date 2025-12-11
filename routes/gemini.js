import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import express from "express";
import 'dotenv/config';
import supabase from "../client/supabase.js"


// initialize google ai with api Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, 
}).single("image");


router.post("/analyze", upload, async (req, res) => {
  const deadCelebs = [
    "Albert Einstein", "Cleopatra", "Julius Caesar", "Shakespeare",
    "Frida Kahlo", "Bruce Lee", "Leonardo da Vinci", "Napoleon Bonaparte",
    "Amelia Earhart", "Marie Curie"
  ];

  const getRandomCeleb = () => deadCelebs[Math.floor(Math.random() * deadCelebs.length)];
  const celebName = getRandomCeleb();

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const base64Image = req.file.buffer.toString("base64");

    const responseSchema = {
      type: "object",
      properties: {
        fallback: {
          type: "string",
          description: "If no food is detected, put 'No food detected'. Otherwise, leave empty or null."
        },
        coachAdvice: {
          type: "string",
          description: `${celebName}, you are a resurrected AI nutrition coach. Give humorous, witty, yet insightful advice about this food in under 30 words.`
        },
        food: {
          type: "string",
          description: "Name of the food in the image. If multiple foods, summarize briefly."
        },
        benefits: {
          type: "array",
          items: { type: "string" },
          description: "2-3 health benefits (e.g., 'Improves skin glow', 'Boosts brain function')"
        },
        calories: {
          type: "number",
          description: "Estimated total calories (numerical value only)"
        },
        carbs: {
          type: "number",
          description: "Estimated total carbs in grams (numerical value only)"
        },
        sugar: {
          type: "number",
          description: "Estimated total sugar in grams (numerical value only)"
        },
        drawbacks: {
          type: "array",
          items: { type: "string" },
          description: "2-3 possible negative effects if over-consumed + suggest healthier alternatives"
        },
        nutrients: {
          type: "array",
          items: { type: "string" },
          description: "2-3 key nutrients with benefits + a health score 1-100 (e.g., 'Vitamin C: boosts immunity - Health score: 85')"
        }
      },
      required: ["coachAdvice", "fallback", "food", "benefits", "calories", "carbs", "sugar", "drawbacks", "nutrients"]
    };


    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
        topP: 0.8,
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an expert nutrition analyst. 
              Carefully analyze the provided image.
              - If it clearly contains food (fruits, vegetables, meals, snacks, ingredients), return structured nutrition data in JSON.
              - If no food is detected (e.g., people, objects, landscapes), set "fallback" to "No food detected" and leave other fields minimal/empty.
              
              The resurrected celebrity coach is: ${celebName}`
            }
          ]
        },
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: base64Image
              }
            }
          ]
        }
      ]
    });

    const responseText = result.text;

    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse JSON response:", responseText);
      return res.status(500).json({ error: "Invalid response format from AI" });
    }

    if (analysis.fallback && analysis.fallback.toLowerCase().includes("no food detected")) {
      return res.json({
        analysis: { fallback: analysis.fallback }
      });
    }

    return res.json({
      analysis: analysis,
      coach: celebName
    });

  } catch (error) {
    console.error("Error analyzing image:", error);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

//here's my router for sending datat to the backend
router.post('/save', async(req, res) => {
  try {
    console.log(req.body);
    const {cal, sugar, carbs, userId, foodName} = req.body;
    
    if(!cal || !sugar || !carbs){
      return res.status(400).json({error: 'sugar, carbs, cal is required'})
    }
    const {data, error} = await supabase
    .from('food_logs')
    .insert([{
      calories: cal,
      carbs: carbs,
      sugar: sugar,
      user_id: userId,
      food_name: foodName
    }])

    if (error) throw error;
    
    return res.status(200).json({success: true, message: 'saved successfully!', data });
  } catch (error) {
    console.error('Error uploading post:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
  }
  return res.status(500).json({ error: error.message ||  'Internal server error',
      details: error,
   });
  } 
})

//router to get the food data that is saved into the food logs
router.get('/getFoodLogs', async(req, res) => {
  const userId = req.query.userId;
  if(!userId){
    return res.status(400).json({error: 'no userId received!'})
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const {data, error} = await supabase
  .from('food_logs')
  .select('*')
  .eq('user_id', userId)
  .gte('created_at', start.toISOString())
  .lt('created_at', end.toISOString())
  .order('created_at', {ascending: false})

  if(error){
    console.error('error fetchin data from foodlogs', error)
    return;
  }

  const totals = data.reduce((acc, item) => {
    acc.totalCalories += item.calories || 0;
    acc.totalCarbs += item.carbs || 0;
    acc.totalSugar += item.sugar || 0;

    return acc;

  }, {totalCalories: 0, totalCarbs: 0, totalSugar: 0})
  
  return res.json({data, totals});
})
export default router;
