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
  try {
    const base64Image = req.file.buffer.toString("base64"); 

    const foodAnalysisFunc = {
        name: 'analyze_food_image', //this is the function name
        description: 'Analyzes food image and returns structured nutrition data. And separate the calories, carbs, and sugar in their own args. ',
        parameters: {
          type: 'object',
          properties: {
            fallback:{
                type: 'string',
                description: 'if food is detected then dont put anything here, else respond "No food detected'
            },
            food: { type: 'string', description: 'Name of the food in the image and if multiple foods are detected then summarize briefly' },
            benefits: {
              type: 'array',
              items: { type: 'string' },
              description: '2-3 Health benefits of the food which body part will benefit e.g., [Make your skin glowing and can cure diseases if available] in one sentence. '
            },
            calories:{
              type:'number',
              description:'Estimated total calories of the food in grams. Return only the numerical value'
            },
            carbs: {
              type:'number',
              description:'Estimated total carbs of the food in grams. Return only the numerical value'
            },
            sugar: {
              type:'number',
              description:'Estimated total sugar of the food in grams. Return only the numerical value'
            },
            drawbacks: {
              type: 'array',
              items: { type: 'string' },
              description: '2-3 Possible negative effects if over-consumed in one sentence and suggest similar foods that are more healthier'
            },
            nutrients: {
              type: 'array',
              items: { type: 'string' },
              description: '2-3 Key nutrients and their general benefits in one sentence and give a health score e.g., [1-100] based on nutrients'
            },
          },
          required: ['fallback','sugar', 'calories', 'carbs', 'food', 'benefits', 'drawbacks', 'nutrients']
        }
      };
      
      const config = {
        tools: [{
            functionDeclarations: [foodAnalysisFunc]
        }]
      }
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: [
        {
            role: 'user',
            parts:[
              {text: `Analyze the image. If food is found — including fruits, vegetables, snacks, or raw ingredients — call the function "analyze_food_image".
                Return the food name and also include health benefits, drawbacks, and nutrients and separate the calories, carbs, sugar. If no food is found, use fallback.`},
                {
                    inlineData:{
                        mimeType: req.file.mimetype,
                        data: base64Image,
                    }
                }
            ]
        }
      ],
      config: config
    });
    // console.log(response.functionCalls[0].args)
    if(response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        const {fallback} = functionCall.args;

        if(fallback && fallback.toLowerCase().includes('no food detected')){
            return res.json({analysis: 
                {fallback: fallback},
            })
        } 

        return res.json({analysis: functionCall.args});
    } else {
        res.status(400).json({error: "No structured response received." })
    }

  } catch (error) {
    console.error("Error analyzing image:", error);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

//here's my router for sending datat to the backend
router.post('/save', async(req, res) => {
  try {
    console.log(req.body);
    const {cal, sugar, carbs, userId} = req.body;
    
    if(!cal || !sugar || !carbs){
      return res.status(400).json({error: 'sugar, carbs, cal is required'})
    }
    const {data, error} = await supabase
    .from('food_logs')
    .insert([{
      calories: cal,
      carbs: carbs,
      sugar: sugar,
      user_id: userId
    }])

    if (error) throw error;

    return res.status(200).json({ message: 'saved successfully!', data });
  } catch (error) {
    console.error('Error uploading post:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
  }
  res.status(500).json({ error: error.message ||  'Internal server error',
      details: error,
   });
  } 
})
export default router;
