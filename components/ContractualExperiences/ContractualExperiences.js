import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import AOS from "aos";
import "aos/dist/aos.css";

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          <Box>{children}</Box>
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `vertical-tab-${index}`,
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}

/**
 * Consulting engagements — the same table as `Experience`, filtered to
 * `kind: CONTRACT`.
 *
 * The two components were near-duplicates over two structurally identical data
 * files, which is why the schema merged them into one model with a discriminator.
 * They stay separate components because the site renders them as two sections
 * with different headings, but they now read from one table, one endpoint and one
 * validation schema.
 */
const ContractualExperiences = ({ experiences = [], section }) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    AOS.init();
  }, []);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };
  return (
    <Box
      className="py-10 md:h-[500px]"
      id={section?.anchor || "contract-exp"}
      data-aos="fade-down"
      data-aos-easing="ease-in-out"
      data-aos-duration="1000"
      data-aos-delay="50"
      data-aos-once="true"
    >
      <Box>
        <Typography variant="h5" className="font-semibold text-[#d2d2d2]">
          <span className="text-[#7a61ff]">{section?.numberLabel || "01.0"} </span>{" "}
          {section?.heading || "Contractual Experiences"}
        </Typography>
      </Box>
      <Box className="mt-4">
        <Box sx={{ flexGrow: 1 }} className="md:flex">
          <Box>
            {/* for desktop view */}
            <Tabs
              orientation="vertical"
              scrollButtons
              allowScrollButtonsMobile
              value={value}
              variant="scrollable"
              onChange={handleChange}
              aria-label="Vertical tabs example"
              sx={{ borderRight: 2, borderColor: "divider" }}
              className="hidden md:block"
            >
              {experiences.map((e, i) => (
                  <Tab
                    label={e.jobPosition}
                    key={e.id}
                    className="text-white w-[180px] normal-case font-[600]"
                    {...a11yProps(i)}
                  />
                ))}
            </Tabs>
          </Box>
          {/* For Mobile View */}
          <Box
            sx={{ maxWidth: { xs: 320, sm: 480 } }}
            className="md:hidden border-2 border-black mt-2 rounded"
          >
            <Tabs
              value={value}
              onChange={handleChange}
              variant="scrollable"
              scrollButtons
              allowScrollButtonsMobile
              aria-label="scrollable force tabs example"
            >
              {experiences.map((e, i) => (
                  <Tab
                    label={e.jobPosition}
                    key={e.id}
                    className="text-white w-[180px] normal-case font-[600]"
                  />
                ))}
            </Tabs>
          </Box>

          {experiences.map((e, i) => (
              <TabPanel
                value={value}
                index={i}
                key={e.id}
                className="md:w-[800px]"
              >
                <Box>
                  <Box>
                    <Typography
                      variant="subtitle1"
                      className="text-white font-[600]"
                    >
                      {e.companyName}
                    </Typography>
                  </Box>
                  <Box className="pb-2">
                    <Typography
                      variant="subtitle2"
                      className="text-white font-[500] pl-4"
                    >
                      {e.timeline}
                    </Typography>
                  </Box>
                  <Box>
                    {e.responsibilities &&
                      e.responsibilities.map((e, i) => (
                        <Box className="flex pt-2" key={i}>
                          <ArrowRightIcon className="text-white" />
                          <Typography
                            variant="subtitle2"
                            className="text-white"
                          >
                            {e}
                          </Typography>
                        </Box>
                      ))}
                  </Box>
                </Box>
              </TabPanel>
            ))}
        </Box>
      </Box>
    </Box>
  );
};

export default ContractualExperiences;
