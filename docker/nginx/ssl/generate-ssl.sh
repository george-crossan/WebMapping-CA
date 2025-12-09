#!/bin/bash

# Generate self-signed SSL certificates for development
# For production, use Let's Encrypt or proper CA certificates

SSL_DIR="$(dirname "$0")"
DOMAIN="${1:-localhost}"

echo "Generating SSL certificate for domain: $DOMAIN"

# Generate private key
openssl genrsa -out "$SSL_DIR/key.pem" 2048

# Generate certificate signing request
openssl req -new -key "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.csr" -subj "/C=IE/ST=Dublin/L=Dublin/O=TUD/OU=CMPU4058/CN=$DOMAIN"

# Generate self-signed certificate
openssl x509 -req -days 365 -in "$SSL_DIR/cert.csr" -signkey "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem"

# Set proper permissions
chmod 600 "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"

echo "SSL certificates generated successfully!"
echo "Certificate: $SSL_DIR/cert.pem"
echo "Private Key: $SSL_DIR/key.pem"

# Cleanup
rm "$SSL_DIR/cert.csr"
