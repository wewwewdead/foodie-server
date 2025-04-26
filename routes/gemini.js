import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import express from "express";
import 'dotenv/config';


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
        description: 'Analyzes food image and returns structured nutrition data. ',
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
              description: '2-3 Health benefits of the food which body part will benefit e.g., [Make your skin glowing and can cure diseases if available] in one sentence and also add information about calories, carbs and sugar e.g .,[calories: 250, carbs: 30, sugar:10/100]'
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
            }
          },
          required: ['fallback', 'food', 'benefits', 'drawbacks', 'nutrients']
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
                {text: 'Analyze the image. If any food is found — including fruits, vegetables, snacks, or raw ingredients — return structured nutritional information and call the function "analyze_food_image".'},
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

export default router;
