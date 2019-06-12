KEYFILE=/run/secrets/privkey.pem

if [ -f $KEYFILE ]; then
    cp $KEYFILE keys/
    echo "Copy done"
else
    echo "Private key for the report provider is not set"
    exit 1
fi

npm start