from fastapi import FastAPI, File, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from transparent_background import Remover
from PIL import Image
import io

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)
remover = Remover(mode='fast', resize='dynamic')

@app.post("/api/remove-background")
async def remove_background_endpoint(file: UploadFile = File(...)):
    image_bytes = await file.read()
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    out_img = remover.process(img, type='rgba')
    buf = io.BytesIO()
    out_img.save(buf, format='PNG')
    return Response(content=buf.getvalue(), media_type='image/png')
