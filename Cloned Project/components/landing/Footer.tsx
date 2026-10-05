import React from "react";
import Link from "next/link";
import { Twitter, Linkedin, Instagram, Github } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[#0C0C0E] border-t border-white/10 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
          {/* Social Icons - Left Side */}
          <div className="flex space-x-6">
            <Link
              href="https://twitter.com/Garage 2.0"
              className="text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </Link>

            <Link
              href="https://linkedin.com/company/Garage 2.0"
              className="text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </Link>

            <Link
              href="https://instagram.com/Garage 2.0"
              className="text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </Link>

            <Link
              href="https://github.com/Garage 2.0"
              className="text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </Link>
          </div>

          {/* Links and Copyright - Right Side */}
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-8">
            <div className="flex space-x-8">
              <Link
                href="/support"
                className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
              >
                Support
              </Link>

              <Link
                href="/terms"
                className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
              >
                Terms
              </Link>

              <Link
                href="/privacy"
                className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
              >
                Privacy
              </Link>
            </div>

            <div className="text-gray-500 text-sm">© 2025 Garage 2.0 HQ</div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
