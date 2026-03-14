#!/bin/sh
set -e

if [ ! -f "$IPFS_PATH/config" ]; then
    echo "Initializing IPFS node (default profile)..."
    ipfs init
    
    echo "Configuring private network..."
    cp /custom/swarm.key "$IPFS_PATH/swarm.key"
    
    # Remove all default public peers
    ipfs bootstrap rm --all

    # Force TCP-only to ensure Bitswap works over Docker bridge networks
    ipfs config --json Addresses.Swarm '["/ip4/0.0.0.0/tcp/4001","/ip6/::/tcp/4001"]'

    # Announce proper DNS address
    ipfs config --json Addresses.Announce "[\"/dns4/$NODE_NAME/tcp/4001\"]"

    # Disable ResourceMgr to stop it silently blocking streams
    ipfs config --json Swarm.ResourceMgr.Enabled false

    # For a small 4-node private cluster, disable DHT and rely entirely on Bitswap broadcast
    ipfs config Routing.Type none

    # Disable AutoConf
    ipfs config --json AutoConf.Enabled false
fi

ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

if [ "$NODE_NAME" != "node1" ]; then
    echo "Waiting for node1 API to get Peer ID for Peering..."
    max_retries=30
    count=0
    node1_id=""
    
    while [ $count -lt $max_retries ]; do
        if out=$(wget -qO- --post-data="" http://node1:5001/api/v0/id 2>/dev/null); then
            node1_id=$(echo "$out" | sed 's/.*"ID":"\([^"]*\)".*/\1/')
            if [ -n "$node1_id" ] && [ "$node1_id" != "$out" ]; then
                echo "Found Node1 Peer ID: $node1_id"
                # Set static Peering to ensure persistent direct bitswap connection
                ipfs config --json Peering '{ "Peers": [{ "ID": "'$node1_id'", "Addrs": ["/dns4/node1/tcp/4001"] }] }'
                break
            fi
        fi
        sleep 2
        count=$((count+1))
    done
fi

echo "Starting IPFS daemon..."
exec ipfs daemon
