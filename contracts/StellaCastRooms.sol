// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StellaCast Rooms
 * @notice Room registry for pay-to-view livestreams. Token IDs are the room NFTs.
 *
 * On-chain lifecycle:
 * 1. Host createRoom() — mints a live room NFT
 * 2. Browse reads getLiveRoomIds() + getRoomMetadata() (no payment)
 * 3. Viewer pays the host via ERC-5564 stealth (not this contract)
 * 4. Host endRoom() — burns the live NFT in the same close transaction
 *
 * Burn is irreversible: encrypted access is wiped, the room leaves Browse,
 * and it cannot go live again. A tombstone stays so the host dashboard can
 * still list ended rooms (title, host, timestamps).
 *
 * Not on this contract, because stealth payments never call it:
 * - paid-join / tip counts (host scanner reads ERC-5564 announcements)
 * - cross-device tickets (local access credential from the stealth secret)
 */
contract StellaCastRooms {
    struct RoomMetadata {
        uint256 tokenId;
        address host;
        string hostEns;
        string title;
        string category;
        string tags;
        string stealthMetaAddress;
        string thumbnail;
        uint256 entryPrice;
        bool isLive;
        bool burned;
        uint256 createdAt;
        uint256 endedAt;
    }

    struct Room {
        RoomMetadata metadata;
        bytes encryptedAccessData;
    }

    uint256 private _nextTokenId = 1;

    mapping(uint256 => Room) private rooms;
    mapping(address => uint256[]) private roomsByHost;
    uint256[] private allRoomIds;
    uint256[] private liveRoomIds;
    mapping(uint256 => uint256) private liveIndexPlusOne;

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

    event RoomEnded(
        uint256 indexed tokenId,
        address indexed host,
        uint256 endedAt
    );

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
        require(bytes(title).length > 0, "Title required");
        require(bytes(stealthMetaAddress).length > 0, "Stealth meta required");

        uint256 tokenId = _nextTokenId++;

        rooms[tokenId] = Room({
            metadata: RoomMetadata({
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
                burned: false,
                createdAt: block.timestamp,
                endedAt: 0
            }),
            encryptedAccessData: encryptedAccessData
        });

        roomsByHost[msg.sender].push(tokenId);
        allRoomIds.push(tokenId);
        _addLive(tokenId);

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
     * @notice Burn the live room NFT. One host transaction. Cannot be undone.
     */
    function endRoom(uint256 tokenId) external {
        Room storage room = rooms[tokenId];
        require(room.metadata.createdAt > 0, "Room does not exist");
        require(room.metadata.host == msg.sender, "Not room owner");
        require(!room.metadata.burned, "Already ended");

        room.metadata.isLive = false;
        room.metadata.burned = true;
        room.metadata.endedAt = block.timestamp;
        room.metadata.stealthMetaAddress = "";
        delete room.encryptedAccessData;
        _removeLive(tokenId);

        emit RoomEnded(tokenId, msg.sender, block.timestamp);
    }

    function getRoomMetadata(uint256 tokenId) external view returns (RoomMetadata memory) {
        return rooms[tokenId].metadata;
    }

    function getEncryptedAccessData(uint256 tokenId) external view returns (bytes memory) {
        Room storage room = rooms[tokenId];
        require(room.metadata.createdAt > 0, "Room does not exist");
        require(room.metadata.isLive && !room.metadata.burned, "Room ended");
        return room.encryptedAccessData;
    }

    function getLiveRoomIds() external view returns (uint256[] memory) {
        return liveRoomIds;
    }

    function getAllRoomIds() external view returns (uint256[] memory) {
        return allRoomIds;
    }

    function getRoomsByHost(address host) external view returns (uint256[] memory) {
        return roomsByHost[host];
    }

    function getTotalRooms() external view returns (uint256) {
        return allRoomIds.length;
    }

    function getLiveRoomCount() external view returns (uint256) {
        return liveRoomIds.length;
    }

    function roomExists(uint256 tokenId) external view returns (bool) {
        return rooms[tokenId].metadata.createdAt > 0;
    }

    function isJoinable(uint256 tokenId) external view returns (bool) {
        RoomMetadata storage meta = rooms[tokenId].metadata;
        return meta.createdAt > 0 && meta.isLive && !meta.burned;
    }

    function _addLive(uint256 tokenId) private {
        liveRoomIds.push(tokenId);
        liveIndexPlusOne[tokenId] = liveRoomIds.length;
    }

    function _removeLive(uint256 tokenId) private {
        uint256 indexPlusOne = liveIndexPlusOne[tokenId];
        if (indexPlusOne == 0) return;

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = liveRoomIds.length - 1;
        uint256 lastTokenId = liveRoomIds[lastIndex];

        if (index != lastIndex) {
            liveRoomIds[index] = lastTokenId;
            liveIndexPlusOne[lastTokenId] = indexPlusOne;
        }

        liveRoomIds.pop();
        delete liveIndexPlusOne[tokenId];
    }
}
