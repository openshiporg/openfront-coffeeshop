import { generateStorefrontMetadata } from "@/features/storefront/components/StorefrontLayout";
import RootHomePage from "@/features/storefront/screens/RootHomePage";
import "./storefront-rigel.css";

export const dynamic = "force-dynamic";
export const generateMetadata = generateStorefrontMetadata;

export default RootHomePage;
