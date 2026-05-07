# Firestore Schema

## stores

Document id 建議使用 `storeId`。

- `id`: string
- `name`: string
- `logoUrl`: string
- `bannerUrl`: string
- `ownerId`: string
- `storeType`: `breakfast | drink | snack | hotpot`
- `isOpen`: boolean
- `notice`: string
- `createdAt`: ISO string

## users

Document id 必須等於 Firebase Auth `uid`。

- `id`: string
- `storeId`: string | null
- `name`: string
- `email`: string
- `role`: `admin | owner | staff | kitchen`

## categories

- `id`: string
- `storeId`: string
- `name`: string
- `sort`: number
- `isActive`: boolean

## products

- `id`: string
- `storeId`: string
- `categoryId`: string
- `name`: string
- `description`: string
- `imageUrl`: string
- `price`: number
- `isAvailable`: boolean
- `isSoldOut`: boolean
- `sort`: number
- `options`: array

## orders

- `id`: string
- `storeId`: string
- `orderNumber`: string
- `pickupNumber`: string
- `mode`: `dine-in | takeout`
- `tableNo`: string
- `customerNote`: string
- `status`: `new | preparing | completed | cancelled`
- `total`: number
- `createdAt`: ISO string
- `updatedAt`: ISO string
- `items`: array of order item objects
