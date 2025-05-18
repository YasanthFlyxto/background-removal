import sys
import os
import torch
import numpy as np
from PIL import Image
from torchvision import transforms
import torch.nn.functional as F

# Add the parent directory to the path so we can import the u2net module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the U2Net model and utilities
from u2net.model import U2NET
from u2net.utils import RescaleT, ToTensorLab

def load_model(model_path):
    """Load the U2Net model from the checkpoint file."""
    model = U2NET(3, 1)
    # Use weights_only=True to address the FutureWarning
    model.load_state_dict(torch.load(model_path, map_location="cpu", weights_only=True))
    model.eval()
    return model

def norm_pred(d):
    """Normalize the prediction."""
    ma = torch.max(d)
    mi = torch.min(d)
    dn = (d - mi) / (ma - mi)
    return dn

def preprocess(image):
    """Preprocess the image for the U2Net model."""
    label_3 = np.zeros(image.shape)
    label = np.zeros(label_3.shape[0:2])

    if 3 == len(label_3.shape):
        label = label_3[:, :, 0]
    elif 2 == len(label_3.shape):
        label = label_3

    if 3 == len(image.shape) and 2 == len(label.shape):
        label = label[:, :, np.newaxis]
    elif 2 == len(image.shape) and 2 == len(label.shape):
        image = image[:, :, np.newaxis]
        label = label[:, :, np.newaxis]

    transform = transforms.Compose([RescaleT(320), ToTensorLab(flag=0)])
    sample = transform({"imidx": np.array([0]), "image": image, "label": label})

    return sample

def remove_background(image_path, output_path):
    """Remove the background from the image and save the result."""
    # Load the model
    model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ckpt", "u2net.pth")
    model = load_model(model_path)
    
    # Load and preprocess the image
    image = Image.open(image_path).convert("RGB")
    image_np = np.array(image)
    sample = preprocess(image_np)
    
    # Process the image with the model
    with torch.no_grad():
        inputs_test = torch.FloatTensor(sample["image"].unsqueeze(0).float())
        d1, _, _, _, _, _, _ = model(inputs_test)
        pred = d1[:, 0, :, :]
        predict = norm_pred(pred).squeeze().cpu().detach().numpy()
        
        # Create a mask from the prediction
        mask = Image.fromarray((predict * 255).astype(np.uint8)).convert("L")
        mask = mask.resize(image.size, resample=Image.BILINEAR)
        
        # Apply the mask to the original image
        image = image.convert("RGBA")
        image_array = np.array(image)
        mask_array = np.array(mask)
        
        # Create an alpha channel from the mask
        # Ensure the alpha channel is properly shaped (2D, not 3D with singleton dimension)
        alpha_channel = mask_array.reshape(mask_array.shape[0], mask_array.shape[1])
        image_array[:, :, 3] = alpha_channel
        
        # Save the result
        result_image = Image.fromarray(image_array)
        result_image.save(output_path, "PNG")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg.py <input_path> <output_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    remove_background(input_path, output_path)
    sys.exit(0)
