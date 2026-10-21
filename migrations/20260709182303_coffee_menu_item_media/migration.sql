/*
  Warnings:

  - The primary key for the `_OrderItem_appliedModifiers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_OrderItem_appliedModifiers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "_OrderItem_appliedModifiers" DROP CONSTRAINT "_OrderItem_appliedModifiers_AB_pkey";

-- CreateTable
CREATE TABLE "MenuItemImage" (
    "id" TEXT NOT NULL,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "imagePath" TEXT NOT NULL DEFAULT '',
    "altText" TEXT NOT NULL DEFAULT '',
    "order" INTEGER DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MenuItem_menuItemImages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_MenuItem_menuItemImages_AB_unique" ON "_MenuItem_menuItemImages"("A", "B");

-- CreateIndex
CREATE INDEX "_MenuItem_menuItemImages_B_index" ON "_MenuItem_menuItemImages"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_OrderItem_appliedModifiers_AB_unique" ON "_OrderItem_appliedModifiers"("A", "B");

-- AddForeignKey
ALTER TABLE "_MenuItem_menuItemImages" ADD CONSTRAINT "_MenuItem_menuItemImages_A_fkey" FOREIGN KEY ("A") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MenuItem_menuItemImages" ADD CONSTRAINT "_MenuItem_menuItemImages_B_fkey" FOREIGN KEY ("B") REFERENCES "MenuItemImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
