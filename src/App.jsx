import React from "react";
import { Footer, Header } from "./components/Layout.jsx";
import { routes } from "./data/site.js";
import BlogPage from "./pages/BlogPage.jsx";
import CoursePage from "./pages/CoursePage.jsx";
import HomePage from "./pages/HomePage.jsx";
import PhotosPage from "./pages/PhotosPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";

function routeFromHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  return routes.some((route) => route.path === raw) ? raw : "/";
}

export default function App() {
  const [route, setRoute] = React.useState(routeFromHash);

  React.useEffect(() => {
    const onHashChange = () => {
      setRoute(routeFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className="site">
      <Header route={route} />
      <main>
        {route === "/" && <HomePage />}
        {route === "/projects" && <ProjectsPage />}
        {route === "/blog" && <BlogPage />}
        {route === "/course" && <CoursePage />}
        {route === "/photos" && <PhotosPage />}
      </main>
      <Footer />
    </div>
  );
}
