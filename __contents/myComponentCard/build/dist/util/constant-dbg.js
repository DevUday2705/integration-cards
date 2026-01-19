sap.ui.define([], function () {
    "use strict";

    return {
        // Define navigation parameters for each role/card
        "recommender": {
            "ibnParams": {
                // Add your specific navigation parameters for recommender role
                "role": "recommender",
                "taskType": "approval"
            }
        },
        "agreer": {
            "ibnParams": {
                // Add your specific navigation parameters for agreer role
                "role": "agreer",
                "taskType": "agreement"
            }
        },
        "performer": {
            "ibnParams": {
                // Add your specific navigation parameters for performer role
                "role": "performer",
                "taskType": "execution"
            }
        },
        "inputProvider": {
            "ibnParams": {
                // Add your specific navigation parameters for input provider role
                "role": "inputProvider",
                "taskType": "input"
            }
        },
        "decider": {
            "ibnParams": {
                // Add your specific navigation parameters for decider role
                "role": "decider",
                "taskType": "decision"
            }
        }
    };
});