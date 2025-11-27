import qrcode
import sys

# Get URL from command line argument or use default
url = sys.argv[1] if len(sys.argv) > 1 else "exp://192.168.100.242:8081"

# Generate QR code
img = qrcode.make(url)
output_path = "/home/plinio/.gemini/antigravity/brain/fac1825a-27ab-492d-bbe2-67187bb7cfdc/expo_qr.png"
img.save(output_path)
print(f"QR code saved to {output_path}")
