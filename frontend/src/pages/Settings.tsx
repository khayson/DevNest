import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../shared/ui/card"
import { Button } from "../shared/ui/button"

export function Settings() {
  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(10px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="space-y-8"
    >
      <section>
        <h2 className="text-xl font-semibold mb-4">Environment Settings</h2>
        <Card>
          <CardHeader>
            <CardTitle>PHP Version</CardTitle>
            <CardDescription>Select the active PHP version for your projects.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button variant="default">PHP 8.2 (Active)</Button>
              <Button variant="outline">PHP 8.1</Button>
              <Button variant="outline">PHP 7.4</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </motion.div>
  )
}
