// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StellaCast Rooms
 * @notice Lightweight room NFT registry for hackathon demo
 * 
 * Each room NFT holds:
 * - Public metadata: title, host ENS, category, tags, status, stealth meta ref
 * - Encrypted access data: room credentials/connection info (viewer needs password to decrypt)
 * 
 * Room lifecycle:
 * 1. Host calls createRoom() → mints NFT with public metadata + encrypted access
 * 2. Browse reads public metadata (no payment required)
 * 3. Viewer pays host via stealth → receives/derives password → decrypts access → enters room
 * 4. Host can update room status (live/offline) via updateRoomStatus()
 * 
 * PRODUCTION NOTES:
 * - Add access control / ownership verification
 * - Consider ERC-721 standard if transferability needed
 * - Add room deletion / cleanup for offline rooms
 * - Optimize gas for metadata storage (IPFS/Arweave for large data)
 */
contract StellaCastRooms {
    struct RoomMetadata {
        uint256 tokenId;
        address host;
        string hostEns;
        string title;
        string category;
        string tags; // comma-separated for simplicity
        string stealthMetaAddress; // host's stealth meta for payments
        string thumbnail; // URL or IPFS hash
        uint256 entryPrice; // in wei
        bool isLive;
        uint256 createdAt;
    }

    struct Room {
        RoomMetadata metadata;
        bytes encryptedAccessData; // encrypted with password derived from stealth payment
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => Room) public rooms;
    mapping(address => uint256[]) public roomsByHost;
    uint256[] public allRoomIds;

    event RoomCreated(
        uint256 indexed tokenId,
        address indexed host,
        string hostEns,
        string title,
        string category,
        string stealthMetaAddress,
        uint256 entryPrice,
        uint256 createdAt
    );

    event RoomStatusUpdated(
        uint256 indexed tokenId,
        bool isLive
    );

    /**
     * @notice Create a new room
     * @param hostEns Host's ENS name
     * @param title Room title
     * @param category Room category
     * @param tags Comma-separated tags
     * @param stealthMetaAddress Host's stealth meta-address for payments
     * @param thumbnail Thumbnail URL or IPFS hash
     * @param entryPrice Entry price in wei
     * @param encryptedAccessData Encrypted room access credentials
     * @return tokenId The newly minted room NFT ID
     */
    function createRoom(
        string memory hostEns,
        string memory title,
        string memory category,
        string memory tags,
        string memory stealthMetaAddress,
        string memory thumbnail,
        uint256 entryPrice,
        bytes memory encryptedAccessData
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        RoomMetadata memory metadata = RoomMetadata({
            tokenId: tokenId,
            host: msg.sender,
            hostEns: hostEns,
            title: title,
            category: category,
            tags: tags,
            stealthMetaAddress: stealthMetaAddress,
            thumbnail: thumbnail,
            entryPrice: entryPrice,
            isLive: true,
            createdAt: block.timestamp
        });

        rooms[tokenId] = Room({
            metadata: metadata,
            encryptedAccessData: encryptedAccessData
        });

        roomsByHost[msg.sender].push(tokenId);
        allRoomIds.push(tokenId);

        emit RoomCreated(
            tokenId,
            msg.sender,
            hostEns,
            title,
            category,
            stealthMetaAddress,
            entryPrice,
            block.timestamp
        );

        return tokenId;
    }

    /**
     * @notice Update room live status
     * @param tokenId Room token ID
     * @param isLive New live status
     */
    function updateRoomStatus(uint256 tokenId, bool isLive) external {
        require(rooms[tokenId].metadata.host == msg.sender, "Not room owner");
        rooms[tokenId].metadata.isLive = isLive;
        emit RoomStatusUpdated(tokenId, isLive);
    }

    /**
     * @notice Get room metadata (public)
     * @param tokenId Room token ID
     * @return metadata Room metadata
     */
    function getRoomMetadata(uint256 tokenId) external view returns (RoomMetadata memory) {
        return rooms[tokenId].metadata;
    }

    /**
     * @notice Get encrypted access data (viewer needs password to decrypt)
     * @param tokenId Room token ID
     * @return encryptedAccessData Encrypted room credentials
     */
    function getEncryptedAccessData(uint256 tokenId) external view returns (bytes memory) {
        return rooms[tokenId].encryptedAccessData;
    }

    /**
     * @notice Get all room IDs
     * @return Array of all room token IDs
     */
    function getAllRoomIds() external view returns (uint256[] memory) {
        return allRoomIds;
    }

    /**
     * @notice Get rooms by host
     * @param host Host address
     * @return Array of room token IDs created by host
     */
    function getRoomsByHost(address host) external view returns (uint256[] memory) {
        return roomsByHost[host];
    }

    /**
     * @notice Get total number of rooms
     * @return Total room count
     */
    function getTotalRooms() external view returns (uint256) {
        return allRoomIds.length;
    }

    /**
     * @notice Check if room exists
     * @param tokenId Room token ID
     * @return true if room exists
     */
    function roomExists(uint256 tokenId) external view returns (bool) {
        return rooms[tokenId].metadata.createdAt > 0;
    }
}
