import "dotenv/config";
import mongoose from "mongoose";
import { Invoice } from "../models/invoice.model";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const inv: any = await Invoice.findById("6a95172b3a0b2c547a9f539c").lean();
  if (!inv) {
    console.log("NOT FOUND");
    await mongoose.disconnect();
    return;
  }
  console.log("invoiceNumber:            ", inv.invoiceNumber);
  console.log("status:                    ", inv.status);
  console.log("itemCurrency:              ", inv.itemCurrency);
  console.log("paymentCurrency:           ", inv.paymentCurrency);
  console.log("totalAmount (minor units): ", inv.totalAmount);
  console.log("organizationId:            ", inv.organizationId);
  console.log("lineItems[0].itemType:     ", inv.lineItems?.[0]?.itemType);
  console.log("metadata.paymentChannel:    ", inv.metadata?.paymentChannel);
  console.log("metadata.allowedWalletCurrencies:", JSON.stringify(inv.metadata?.allowedWalletCurrencies));
  console.log("metadata.hifiApplicationId: ", inv.metadata?.hifiApplicationId);
  console.log("full metadata:", JSON.stringify(inv.metadata, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
